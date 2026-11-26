const playBetMan = require("../clients/playbetman.client");
const {
  saveRawResponse,
  saveNormalizedData,
} = require("../services/storage.service");
const { normalizeSnapshot } = require("../normalizers/snapshot.normalizer");

async function collectStandings(competition_id) {
  if (!competition_id) throw new Error("competition_id is required");

  const response = await playBetMan.fetchStanding({ competition_id });
  saveRawResponse("standings", response);

  const snapshot = normalizeSnapshot("standings", response);
  saveNormalizedData("standings", snapshot);
  return snapshot;
}

module.exports = { collectStandings };
