const playBetMan = require("../clients/playbetman.client");
const {
  saveRawResponse,
  saveNormalizedData,
} = require("../services/storage.service");
const { normalizeResults } = require("../normalizers/results.normalizer");

async function collectResults(competition_id) {
  if (!competition_id) throw new Error("competition_id is required");

  const response = await playBetMan.fetchResults({ competition_id });

  // Preserve the complete API response before transforming it.
  const rawFile = saveRawResponse("results", response);

  const matches = normalizeResults(response);
  const normalizedFile = saveNormalizedData("results", matches);

  console.log(`Collected ${matches.length} normalized result matches.`);

  return {
    competitionId: competition_id,
    totalMatches: matches.length,
    rawFile,
    normalizedFile,
    matches,
  };
}

module.exports = { collectResults };
