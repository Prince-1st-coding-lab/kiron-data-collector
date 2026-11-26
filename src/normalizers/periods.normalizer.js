function normalizePeriods(response) {
  if (!response || typeof response !== "object" || !Array.isArray(response.periods)) {
    throw new TypeError('Invalid periods response: expected a "periods" array.');
  }

  return response.periods
    .filter((period) => period && typeof period === "object" && period.round_id != null)
    .map((period) => ({
      roundId: String(period.round_id),
      startTime: period.start_time ?? null,
      endTime: period.end_time ?? null,
      seasonId: period.season_id == null ? null : String(period.season_id),
      competitionId: period.competition_id ?? null,
    }))
    .sort((a, b) => String(a.startTime || "").localeCompare(String(b.startTime || "")));
}

module.exports = { normalizePeriods };
