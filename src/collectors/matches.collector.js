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
    sourceRoundId: match.roundId ?? null,
    roundId: String(round_id),
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


/**
 * Collect the same round through multiple provider market subtype IDs and
 * merge responses into one fixture dataset. Provider IDs must be verified
 * from actual PlayBetMan requests; they are not inferred from our market keys.
 */
async function collectMatchesForMarkets({ round_id, competition_id, marketTypes, tab = "" }) {
  const types = [...new Set((marketTypes || []).map((value) => String(value).trim()).filter(Boolean))];
  if (!types.length) throw new Error("At least one verified market subtype ID is required.");

  const byMatch = new Map();
  const rawFiles = [];

  for (const marketType of types) {
    const response = await playBetMan.fetchMatches({
      round_id,
      competition_id,
      sub_type_id: marketType,
      tab,
    });
    rawFiles.push(saveRawResponse("matches", response));

    const normalized = normalizeMatches(response);
    for (const match of normalized) {
      const key = match.matchId
        ? String(match.matchId)
        : [match.startTime, match.homeTeam, match.awayTeam].join("|");
      const existing = byMatch.get(key);
      if (!existing) {
        byMatch.set(key, {
          ...match,
          sourceRoundId: match.roundId ?? null,
          roundId: String(round_id),
          competitionId: match.competitionId ?? competition_id,
          requestedMarketTypes: [marketType],
        });
        continue;
      }

      existing.requestedMarketTypes.push(marketType);
      const combined = [...(existing.markets || []), ...(match.markets || [])];
      const uniqueMarkets = new Map();
      for (const market of combined) {
        const marketKey = [market.marketType, market.oddType].join("|");
        uniqueMarkets.set(marketKey, market);
      }
      existing.markets = [...uniqueMarkets.values()];
    }
  }

  const matches = [...byMatch.values()].map((match) => ({
    ...match,
    requestedMarketTypes: [...new Set(match.requestedMarketTypes)],
  }));
  const normalizedFile = saveNormalizedData("matches", matches);
  console.log("Collected " + matches.length + " fixtures across " + types.length + " market subtype(s).");

  return {
    competitionId: competition_id,
    roundId: String(round_id),
    marketTypes: types,
    totalMatches: matches.length,
    rawFiles,
    normalizedFile,
    matches,
  };
}

module.exports = { collectMatches, collectMatchesForMarkets };
