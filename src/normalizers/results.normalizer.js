/**
 * Normalize PlayBetMan /league/fetchResults responses.
 *
 * The API groups matches inside results[] batches. This module flattens those
 * batches into one record per match while retaining the batch metadata.
 */

function parseScore(score) {
  if (typeof score !== "string") return null;

  const match = score.trim().match(/^(\d+)\s*:\s*(\d+)$/);
  if (!match) return null;

  return {
    home: Number(match[1]),
    away: Number(match[2]),
  };
}

function normalizeGoalTimes(times) {
  if (times == null) return [];

  if (!Array.isArray(times)) {
    throw new TypeError("Goal times must be an array or null.");
  }

  return times
    .filter((minute) => Number.isInteger(Number(minute)) && Number(minute) >= 0)
    .map(Number);
}

function normalizeMatch(match, batch) {
  if (!match || typeof match !== "object") {
    throw new TypeError("Each result match must be an object.");
  }

  const finalScore = parseScore(match.result);
  const halfTimeScore = parseScore(match.half_time_scores);

  return {
    matchId: match.parent_match_id == null
      ? null
      : String(match.parent_match_id),

    competitionId: batch.competition_id ?? match.competition_id ?? null,
    competitionName: batch.competition_name ?? null,
    seasonId: batch.season_id == null ? null : String(batch.season_id),
    roundId: batch.round_id == null ? null : String(batch.round_id),

    startTime: batch.start_time ?? null,
    endTime: batch.end_time ?? null,

    homeTeam: match.home_team ?? null,
    awayTeam: match.away_team ?? null,
    homeTeamImage: match.h_img ?? null,
    awayTeamImage: match.a_img ?? null,

    homeScore: finalScore?.home ?? null,
    awayScore: finalScore?.away ?? null,
    halfTimeHomeScore: halfTimeScore?.home ?? null,
    halfTimeAwayScore: halfTimeScore?.away ?? null,

    homeScoreTimes: normalizeGoalTimes(match.home_score_times),
    awayScoreTimes: normalizeGoalTimes(match.away_score_times),

    finalScoreText: match.result ?? null,
    halfTimeScoreText: match.half_time_scores ?? null,
  };
}

/**
 * @param {object} response Full JSON response returned by fetchResults.
 * @returns {Array<object>} A flat array containing one record per match.
 */
function normalizeResults(response) {
  if (!response || typeof response !== "object" || Array.isArray(response)) {
    throw new TypeError("Results response must be a JSON object.");
  }

  if (!Array.isArray(response.results)) {
    throw new TypeError('Invalid results response: expected a "results" array.');
  }

  return response.results.flatMap((batch) => {
    if (!batch || typeof batch !== "object") return [];
    if (!Array.isArray(batch.matches)) return [];

    return batch.matches.map((match) => normalizeMatch(match, batch));
  });
}

module.exports = {
  normalizeResults,
  parseScore,
};
