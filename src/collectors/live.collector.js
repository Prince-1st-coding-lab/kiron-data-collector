const playBetMan = require("../clients/playbetman.client");
const {
  saveRawResponse,
  saveNormalizedData,
} = require("../services/storage.service");
const { normalizeSnapshot } = require("../normalizers/snapshot.normalizer");

async function collectLive({ period, end_time, competition_id, round_id, sub_type_id = "1X2", tab = "" }) {
  if (!period || !end_time || !competition_id || !round_id) {
    throw new Error("period, end_time, competition_id and round_id are required");
  }

  const response = await playBetMan.fetchLive({
    period,
    end_time,
    competition_id,
    round_id,
    sub_type_id,
    tab
  });

  saveRawResponse("live", response);
  const snapshot = {
    ...normalizeSnapshot("live", response),
    round: {
      roundId: String(round_id),
      period,
      endTime: end_time,
      competitionId: competition_id,
    },
  };
  saveNormalizedData("live", snapshot);
  return snapshot;
}

module.exports = { collectLive };
