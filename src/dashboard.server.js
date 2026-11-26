const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "data", "normalized");
const PUBLIC = path.join(process.cwd(), "public");
const { evaluateHistoricalPredictions, buildTopPicks, recentRoundPredictionSnapshots } = require("./services/performance.service");

let analyticsCache = null;
let analyticsCacheAt = 0;

function getDashboardAnalytics() {
  if (analyticsCache && Date.now() - analyticsCacheAt < 10000) return analyticsCache;
  const performance = evaluateHistoricalPredictions();
  const roundSnapshots = recentRoundPredictionSnapshots(2);
  analyticsCache = {
    performance,
    roundSnapshots,
    topPicks: buildTopPicks(performance, 2),
  };
  analyticsCacheAt = Date.now();
  return analyticsCache;
}

function latest(prefix) {
  if (!fs.existsSync(ROOT)) return null;
  const files = fs.readdirSync(ROOT)
    .filter((name) => name.startsWith(prefix + "-") && name.endsWith(".json"))
    .sort();
  if (!files.length) return null;
  const filename = files[files.length - 1];
  const filePath = path.join(ROOT, filename);
  try {
    const stat = fs.statSync(filePath);
    return {
      filename,
      collectedAt: stat.mtime.toISOString(),
      data: JSON.parse(fs.readFileSync(filePath, "utf8")),
    };
  } catch (error) {
    return { filename, collectedAt: null, error: "Could not read latest dataset: " + error.message, data: null };
  }
}

function getResultsFreshness(resultsFile) {
  const intervalMinutes = Number(process.env.RESULTS_INTERVAL_MINUTES || 10);
  const staleAfterMs = (Number.isFinite(intervalMinutes) && intervalMinutes > 0 ? intervalMinutes : 10) * 2 * 60 * 1000;
  if (!resultsFile?.collectedAt) {
    return { status: "NO_DATA", lastCollectedAt: null, ageMs: null, staleAfterMs };
  }

  const collectedAtMs = new Date(resultsFile.collectedAt).getTime();
  const ageMs = Math.max(0, Date.now() - collectedAtMs);
  return {
    status: ageMs <= staleAfterMs ? "FRESH" : "STALE",
    lastCollectedAt: resultsFile.collectedAt,
    ageMs,
    staleAfterMs,
  };
}

function sendJson(res, data) {
  res.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "same-origin",
  });
  res.end(JSON.stringify(data));
}

function startDashboardServer(port = Number(process.env.DASHBOARD_PORT || 3000)) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url, "http://localhost");

    if (req.method !== "GET") {
      res.writeHead(405);
      return res.end("Method not allowed");
    }

    if (url.pathname.startsWith("/api/")) {
      const predictions = latest("predictions");
      const matches = latest("matches");
      const results = latest("results");
      const live = latest("live");
      const standings = latest("standings");

      if (url.pathname === "/api/dashboard") {
        const { performance, roundSnapshots, topPicks } = getDashboardAnalytics();
        const combinedPredictions = roundSnapshots.flatMap((snapshot) =>
          (snapshot.predictions || []).map((prediction) => ({
            ...prediction,
            roundId: snapshot.roundId || snapshot.currentRoundId || null,
            roundStartTime: snapshot.roundStartTime || null,
            roundEndTime: snapshot.roundEndTime || null,
          }))
        );
        return sendJson(res, {
          updatedAt: new Date().toISOString(),
          resultsFreshness: getResultsFreshness(results),
          predictions: combinedPredictions.length ? combinedPredictions : (predictions?.data?.predictions || []),
          predictionMeta: predictions?.data || null,
          roundPredictions: roundSnapshots.map((snapshot) => ({
            roundId: snapshot.roundId || snapshot.currentRoundId || null,
            roundStartTime: snapshot.roundStartTime || null,
            roundEndTime: snapshot.roundEndTime || null,
            fixtureCount: (snapshot.predictions || []).length,
          })),
          performance,
          topPicks,
          matches: Array.isArray(matches?.data) ? matches.data : [],
          results: Array.isArray(results?.data) ? results.data : [],
          live: live?.data || null,
          liveCollectedAt: live?.collectedAt || null,
          standings: standings?.data || null,
          files: {
            predictions: predictions?.filename || null,
            matches: matches?.filename || null,
            results: results?.filename || null,
            live: live?.filename || null,
            standings: standings?.filename || null,
          },
        });
      }

      if (url.pathname === "/api/health") {
        return sendJson(res, {
          ok: true,
          dataDirectoryExists: fs.existsSync(ROOT),
          resultsFreshness: getResultsFreshness(results),
          latestFiles: {
            predictions: predictions?.filename || null,
            matches: matches?.filename || null,
            results: results?.filename || null,
          },
        });
      }

      return sendJson(res, { error: "Not found" });
    }

    const requested = url.pathname === "/" ? "index.html" : url.pathname.slice(1);
    if (requested !== "index.html") {
      res.writeHead(404);
      return res.end("Not found");
    }

    const file = path.join(PUBLIC, "index.html");
    if (!fs.existsSync(file)) {
      res.writeHead(404);
      return res.end("Dashboard page not found.");
    }
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-cache" });
    fs.createReadStream(file).pipe(res);
  });

  server.listen(port, "0.0.0.0", () => {
    console.log(`Dashboard available at http://localhost:${port}`);
  });
  return server;
}

module.exports = { startDashboardServer };
