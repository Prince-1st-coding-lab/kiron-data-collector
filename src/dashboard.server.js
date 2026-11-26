const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(process.cwd(), "data", "normalized");
const PUBLIC = path.join(process.cwd(), "public");

function latest(prefix) {
  if (!fs.existsSync(ROOT)) return null;
  const files = fs.readdirSync(ROOT)
    .filter((name) => name.startsWith(prefix + "-") && name.endsWith(".json"))
    .sort();
  if (!files.length) return null;
  const filename = files[files.length - 1];
  try {
    return { filename, data: JSON.parse(fs.readFileSync(path.join(ROOT, filename), "utf8")) };
  } catch (error) {
    return { filename, error: "Could not parse latest dataset: " + error.message, data: null };
  }
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
        return sendJson(res, {
          updatedAt: new Date().toISOString(),
          predictions: predictions?.data?.predictions || [],
          predictionMeta: predictions?.data || null,
          matches: Array.isArray(matches?.data) ? matches.data : [],
          results: Array.isArray(results?.data) ? results.data : [],
          live: live?.data || null,
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
