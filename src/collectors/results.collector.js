const playBetMan = require("../clients/playbetman.client");
const { saveRawResponse } = require("../services/storage.service");

async function collectResults(competition_id) {
  if (!competition_id) throw new Error("competition_id is required");

  const data = await playBetMan.fetchResults({ competition_id });
  saveRawResponse("results", data);
  return data;
}

module.exports = { collectResults };
