/**
 * Normalize the matches[] collection returned by /league/fetchMatches.
 * Market outcomes are retained so historical odds can be analyzed later.
 */

function normalizeMatches(response) {
  if (!response || typeof response !== "object" || !Array.isArray(response.matches)) {
    throw new TypeError('Invalid matches response: expected a "matches" array.');
  }

  return response.matches.map((match) => {
    if (!match || typeof match !== "object") {
      throw new TypeError("Each match must be an object.");
    }

    const markets = Array.isArray(match.markets)
      ? match.markets.map((market) => ({
          marketType: market.sub_type_id ?? null,
          oddType: market.odd_type ?? null,
          outcomes: Array.isArray(market.outcomes)
            ? market.outcomes.map((outcome) => ({
                outcomeId: outcome.outcome_id ?? null,
                outcomeKey: outcome.outcome_key ?? null,
                outcomeName: outcome.outcome_name ?? null,
                oddValue: outcome.odd_value == null || outcome.odd_value === ""
                  ? null
                  : Number(outcome.odd_value),
                status: outcome.status ?? null,
              }))
            : [],
        }))
      : [];

    return {
      matchId: match.parent_match_id == null ? null : String(match.parent_match_id),
      competitionId: match.competition_id ?? null,
      seasonId: match.season_id == null ? null : String(match.season_id),
      roundId: match.round_id == null ? null : String(match.round_id),
      startTime: match.start_time ?? null,
      endTime: match.end_time ?? null,
      homeTeam: match.home_team ?? null,
      awayTeam: match.away_team ?? null,
      homeTeamImage: match.h_img ?? null,
      awayTeamImage: match.a_img ?? null,
      status: match.result ? "completed" : "scheduled",
      result: match.result ?? null,
      markets,
      source: "fetchMatches",
      collectedAt: new Date().toISOString(),
    };
  });
}

module.exports = { normalizeMatches };
