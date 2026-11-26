const fs = require("fs");
const path = require("path");
const { saveNormalizedData } = require("./storage.service");

const DATA_DIR = path.join(process.cwd(), "data", "normalized");

function latestDataset(prefix) {
  if (!fs.existsSync(DATA_DIR)) return null;

  const file = fs.readdirSync(DATA_DIR)
    .filter((name) => name.startsWith(`${prefix}-`) && name.endsWith(".json"))
    .sort()
    .at(-1);

  if (!file) return null;

  const filePath = path.join(DATA_DIR, file);
  return {
    file: filePath,
    data: JSON.parse(fs.readFileSync(filePath, "utf8")),
  };
}

function mergeMatchRecords(fixtures, results) {
  const byId = new Map();

  for (const fixture of Array.isArray(fixtures) ? fixtures : []) {
    const key = fixture.matchId || `fixture:${byId.size}`;
    byId.set(key, { ...fixture, fixture });
  }

  for (const result of Array.isArray(results) ? results : []) {
    const key = result.matchId || `result:${byId.size}`;
    const existing = byId.get(key) || {};
    byId.set(key, { ...existing, ...result, fixture: existing.fixture || null, result });
  }

  return [...byId.values()];
}

function buildUnifiedDataset() {
  const fixtures = latestDataset("matches");
  const results = latestDataset("results");
  const live = latestDataset("live");
  const standings = latestDataset("standings");

  const dataset = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sources: {
      matches: fixtures?.file || null,
      results: results?.file || null,
      live: live?.file || null,
      standings: standings?.file || null,
    },
    matches: mergeMatchRecords(fixtures?.data, results?.data),
    live: live?.data || null,
    standings: standings?.data || null,
  };

  const filePath = saveNormalizedData("unified", dataset);
  console.log(`Unified dataset contains ${dataset.matches.length} match records.`);

  return { filePath, dataset };
}

module.exports = { buildUnifiedDataset };
