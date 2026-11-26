const playBetMan = require("../clients/playbetman.client");
const { saveRawResponse } = require("../services/storage.service");

async function collectStandings(competition_id) {
  if (!competition_id) throw new Error("competition_id is required");

  const data = await playBetMan.fetchStanding({ competition_id });
  saveRawResponse("standings", data);
  return data;
}

module.exports = { collectStandings };
