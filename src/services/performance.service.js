const fs = require("fs");
const path = require("path");

const DATA_DIR = path.join(process.cwd(), "data", "normalized");
const MARKET_KEYS = ["1X2", "BTTS", "1X2_BTTS", "OVER_UNDER_1_5", "DOUBLE_CHANCE"];

function readJsonFiles(prefix) {
  if (!fs.existsSync(DATA_DIR)) return [];
  return fs.readdirSync(DATA_DIR)
    .filter((name) => name.startsWith(prefix + "-") && name.endsWith(".json"))
    .sort()
    .map((name) => {
      try {
        return { name, data: JSON.parse(fs.readFileSync(path.join(DATA_DIR, name), "utf8")) };
      } catch {
        return null;
      }
    })
    .filter(Boolean);
}

function parseInTimezone(value, timeZone = process.env.PLAYBETMAN_TIMEZONE || "Africa/Johannesburg") {
  if (!value) return NaN;
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return new Date(value).getTime();
  const [, y, mo, d, h, mi, s = "0"] = match;
  const targetUtc = Date.UTC(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23",
  }).formatToParts(new Date(targetUtc));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const representedUtc = Date.UTC(Number(values.year), Number(values.month) - 1,
    Number(values.day), Number(values.hour), Number(values.minute), Number(values.second));
  const offset = representedUtc - targetUtc;
  return targetUtc - offset;
}

function resultKey(match) {
  return match.matchId
    ? "id:" + String(match.matchId)
    : "teams:" + [match.homeTeam, match.awayTeam, match.startTime].join("|").toLowerCase();
}

function actualMarketOutcomes(result) {
  const home = Number(result.homeScore);
  const away = Number(result.awayScore);
  if (!Number.isInteger(home) || !Number.isInteger(away)) return null;
  const outcome = home > away ? "HOME" : home < away ? "AWAY" : "DRAW";
  const btts = home > 0 && away > 0 ? "YES" : "NO";
  return {
    "1X2": outcome,
    BTTS: btts,
    "1X2_BTTS": outcome + "_" + btts,
    OVER_UNDER_1_5: home + away >= 2 ? "OVER" : "UNDER",
    DOUBLE_CHANCE: outcome === "HOME" ? ["1X", "12"] : outcome === "AWAY" ? ["12", "X2"] : ["1X", "X2"],
  };
}

function evaluateHistoricalPredictions() {
  const resultMap = new Map();
  for (const file of readJsonFiles("results")) {
    if (!Array.isArray(file.data)) continue;
    for (const result of file.data) {
      if (Number.isInteger(result.homeScore) && Number.isInteger(result.awayScore)) {
        resultMap.set(resultKey(result), result);
      }
    }
  }

  const records = [];
  const seen = new Set();
  for (const file of readJsonFiles("predictions")) {
    const snapshot = file.data;
    if (!snapshot || !Array.isArray(snapshot.predictions)) continue;
    const generatedAt = new Date(snapshot.generatedAt || 0).getTime();
    for (const prediction of snapshot.predictions) {
      if (prediction.status !== "estimated") continue;
      const key = resultKey(prediction);
      const result = resultMap.get(key);
      if (!result) continue;
      const kickoff = parseInTimezone(result.startTime || prediction.startTime);
      // Prevent look-ahead leakage: only score forecasts created before kickoff.
      if (!Number.isFinite(generatedAt) || !Number.isFinite(kickoff) || generatedAt >= kickoff) continue;
      const actual = actualMarketOutcomes(result);
      if (!actual) continue;
      for (const marketKey of MARKET_KEYS) {
        const unique = [snapshot.roundId || prediction.roundId || "", key, marketKey].join("|");
        if (seen.has(unique)) continue;
        seen.add(unique);
        const market = prediction.markets?.[marketKey];
        const selected = market?.bestOutcome;
        if (!selected) continue;
        records.push({
          roundId: snapshot.roundId || prediction.roundId || result.roundId || null,
          matchId: result.matchId || prediction.matchId || null,
          marketKey,
          selected,
          actual: actual[marketKey],
          correct: Array.isArray(actual[marketKey]) ? actual[marketKey].includes(selected) : selected === actual[marketKey],
          probability: Number(market.outcomes?.[selected] ?? 0),
          generatedAt: snapshot.generatedAt,
          startTime: result.startTime,
        });
      }
    }
  }

  const summary = {};
  for (const marketKey of MARKET_KEYS) {
    const rows = records.filter((row) => row.marketKey === marketKey);
    const correct = rows.filter((row) => row.correct).length;
    summary[marketKey] = {
      evaluated: rows.length,
      correct,
      incorrect: rows.length - correct,
      accuracy: rows.length ? Number((correct / rows.length * 100).toFixed(1)) : null,
    };
  }
  const correct = records.filter((row) => row.correct).length;
  return {
    evaluatedPicks: records.length,
    correct,
    incorrect: records.length - correct,
    accuracy: records.length ? Number((correct / records.length * 100).toFixed(1)) : null,
    byMarket: summary,
    recentEvaluations: records.slice(-100).reverse(),
  };
}

function recentRoundPredictionSnapshots(limit = 2) {
  const byRound = new Map();
  for (const file of readJsonFiles("predictions")) {
    const data = file.data;
    if (!data || !Array.isArray(data.predictions)) continue;
    const roundId = String(data.roundId || data.currentRoundId || "");
    if (!roundId) continue;
    const previous = byRound.get(roundId);
    if (!previous || String(data.generatedAt) > String(previous.generatedAt)) {
      byRound.set(roundId, data);
    }
  }
  return [...byRound.values()]
    .sort((a, b) => String(a.roundStartTime || "").localeCompare(String(b.roundStartTime || "")))
    .slice(0, limit);
}

function formSupport(prediction, marketKey, selection) {
  const home = prediction.homeRecentForm || {};
  const away = prediction.awayRecentForm || {};
  const homePoints = Number(home.pointsPerMatch || 0);
  const awayPoints = Number(away.pointsPerMatch || 0);
  if (marketKey === "BTTS") {
    const goalsFor = Number(home.goalsScored || 0) + Number(away.goalsScored || 0);
    const goalsAgainst = Number(home.goalsConceded || 0) + Number(away.goalsConceded || 0);
    const yesSupport = Math.max(0, Math.min(100, 35 + (goalsFor + goalsAgainst) * 2));
    return selection === "YES" ? yesSupport : 100 - yesSupport;
  }
  if (marketKey === "OVER_UNDER_1_5") {
    const totalRecentGoals = Number(home.goalsScored || 0) + Number(home.goalsConceded || 0) +
      Number(away.goalsScored || 0) + Number(away.goalsConceded || 0);
    const overSupport = Math.max(0, Math.min(100, 30 + totalRecentGoals * 1.5));
    return selection === "OVER" ? overSupport : 100 - overSupport;
  }
  if (marketKey === "1X2" || marketKey === "DOUBLE_CHANCE" || marketKey === "1X2_BTTS") {
    if (selection.startsWith("HOME") || selection === "1X") return Math.max(0, Math.min(100, 50 + (homePoints - awayPoints) * 12));
    if (selection.startsWith("AWAY") || selection === "X2") return Math.max(0, Math.min(100, 50 + (awayPoints - homePoints) * 12));
    if (selection === "DRAW" || selection.startsWith("DRAW")) return Math.max(0, 100 - Math.abs(homePoints - awayPoints) * 12);
    if (selection === "12") return Math.max(0, 100 - Math.max(0, 2 - Math.abs(homePoints - awayPoints)) * 15);
  }
  return 50;
}

function buildTopPicks(performance = evaluateHistoricalPredictions(), roundLimit = 2) {
  const snapshots = recentRoundPredictionSnapshots(roundLimit);
  const candidates = [];
  for (const snapshot of snapshots) {
    for (const prediction of snapshot.predictions || []) {
      if (prediction.status !== "estimated") continue;
      for (const marketKey of MARKET_KEYS) {
        const market = prediction.markets?.[marketKey];
        if (!market?.bestOutcome) continue;
        const probability = Number(market.outcomes?.[market.bestOutcome] || 0);
        const sampleSize = Math.min(
          Number(prediction.homeVenueMatches || 0),
          Number(prediction.awayVenueMatches || 0)
        );
        const sampleSupport = Math.min(100, sampleSize / 8 * 100);
        const historical = performance.byMarket?.[marketKey];
        const historicalSupport = historical?.evaluated >= 10 ? historical.accuracy : 50;
        const form = formSupport(prediction, marketKey, market.bestOutcome);
        const score = probability * 0.55 + sampleSupport * 0.15 +
          historicalSupport * 0.20 + form * 0.10;
        candidates.push({
          roundId: snapshot.roundId,
          roundStartTime: snapshot.roundStartTime,
          matchId: prediction.matchId,
          fixture: prediction.homeTeam + " vs " + prediction.awayTeam,
          homeTeam: prediction.homeTeam,
          awayTeam: prediction.awayTeam,
          marketKey,
          marketName: market.name || marketKey,
          selection: market.bestOutcome,
          probability: Number(probability.toFixed(1)),
          rankingScore: Number(score.toFixed(1)),
          factors: {
            statisticalProbability: Number(probability.toFixed(1)),
            venueSampleSupport: Number(sampleSupport.toFixed(1)),
            historicalMarketAccuracy: historical?.evaluated >= 10 ? historical.accuracy : null,
            recentFormSupport: Number(form.toFixed(1)),
          },
          historicalEvaluationCount: historical?.evaluated || 0,
          sampleSize,
          expectedHomeGoals: prediction.expectedHomeGoals,
          expectedAwayGoals: prediction.expectedAwayGoals,
          warning: sampleSize < 5 ? "Limited venue-specific history" : null,
        });
      }
    }
  }
  return candidates.sort((a, b) => b.rankingScore - a.rankingScore).slice(0, 3);
}

module.exports = { evaluateHistoricalPredictions, buildTopPicks, recentRoundPredictionSnapshots, actualMarketOutcomes, parseInTimezone };
