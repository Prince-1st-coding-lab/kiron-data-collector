const playBetMan = require("../clients/playbetman.client");
const {
  saveRawResponse,
  saveNormalizedData,
} = require("../services/storage.service");
const { normalizeMatches } = require("../normalizers/matches.normalizer");

async function collectMatches({ round_id, competition_id, sub_type_id = "1X2", tab = "" }) {
  if (!round_id || !competition_id) {
    throw new Error("round_id and competition_id are required");
  }

  const response = await playBetMan.fetchMatches({
    round_id,
    competition_id,
    sub_type_id,
    tab
  });

  const rawFile = saveRawResponse("matches", response);
  const matches = normalizeMatches(response).map((match) => ({
    ...match,
    roundId: match.roundId ?? String(round_id),
    competitionId: match.competitionId ?? competition_id,
  }));
  const normalizedFile = saveNormalizedData("matches", matches);

  console.log(`Collected ${matches.length} normalized fixture matches.`);

  return {
    competitionId: competition_id,
    roundId: String(round_id),
    totalMatches: matches.length,
    rawFile,
    normalizedFile,
    matches,
  };
}

module.exports = { collectMatches };
