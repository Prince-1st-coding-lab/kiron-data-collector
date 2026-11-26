const playBetMan = require("../clients/playbetman.client");
const { saveRawResponse } = require("../services/storage.service");

async function collectMatches({ round_id, competition_id, sub_type_id = "1X2", tab = "" }) {
  if (!round_id || !competition_id) {
    throw new Error("round_id and competition_id are required");
  }

  const data = await playBetMan.fetchMatches({
    round_id,
    competition_id,
    sub_type_id,
    tab
  });

  saveRawResponse("matches", data);
  return data;
}

module.exports = { collectMatches };
