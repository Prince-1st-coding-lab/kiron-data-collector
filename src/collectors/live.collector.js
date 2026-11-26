const playBetMan = require("../clients/playbetman.client");
const { saveRawResponse } = require("../services/storage.service");

async function collectLive({ period, end_time, competition_id, round_id, sub_type_id = "1X2", tab = "" }) {
  if (!period || !end_time || !competition_id || !round_id) {
    throw new Error("period, end_time, competition_id and round_id are required");
  }

  const data = await playBetMan.fetchLive({
    period,
    end_time,
    competition_id,
    round_id,
    sub_type_id,
    tab
  });

  saveRawResponse("live", data);
  return data;
}

module.exports = { collectLive };
