const test = require("node:test");
const assert = require("node:assert/strict");

const { parseScore } = require("../normalizers/results.normalizer");
const { normalizeResults } = require("../normalizers/results.normalizer");
const { normalizeMatches } = require("../normalizers/matches.normalizer");
const { normalizeSnapshot } = require("../normalizers/snapshot.normalizer");
const { normalizePeriods } = require("../normalizers/periods.normalizer");
const { getNextUpcomingPeriod } = require("../collectors/rounds.collector");

test("parseScore converts a score string to numeric values", () => {
  assert.deepEqual(parseScore("1:3"), { home: 1, away: 3 });
  assert.deepEqual(parseScore(" 2 : 0 "), { home: 2, away: 0 });
  assert.equal(parseScore("not-a-score"), null);
});

test("normalizeResults flattens result batches", () => {
  const response = {
    results: [{
      competition_id: 8,
      competition_name: "French League",
      season_id: "season-1",
      round_id: "34",
      start_time: "2026-11-26 08:10:00",
      end_time: "2026-11-26 08:11:05",
      matches: [{
        parent_match_id: "match-1",
        home_team: "Strasbourg",
        away_team: "Nantes",
        result: "1:3",
        half_time_scores: "1:2",
        home_score_times: [3],
        away_score_times: [21, 39, 63]
      }]
    }]
  };

  const matches = normalizeResults(response);
  assert.equal(matches.length, 1);
  assert.equal(matches[0].homeScore, 1);
  assert.equal(matches[0].awayScore, 3);
  assert.deepEqual(matches[0].awayScoreTimes, [21, 39, 63]);
});

test("normalizeMatches retains market outcomes and numeric odds", () => {
  const response = {
    matches: [{
      parent_match_id: "fixture-1",
      home_team: "Home",
      away_team: "Away",
      markets: [{
        sub_type_id: "1X2",
        outcomes: [{ outcome_key: "home", outcome_name: "Home", odd_value: "1.96" }]
      }]
    }]
  };

  const matches = normalizeMatches(response);
  assert.equal(matches[0].matchId, "fixture-1");
  assert.equal(matches[0].markets[0].outcomes[0].oddValue, 1.96);
});

test("normalizeSnapshot preserves undocumented API fields", () => {
  const response = { standings: [{ team: "Team A", points: 12 }], extra: "kept" };
  const snapshot = normalizeSnapshot("standings", response);
  assert.equal(snapshot.source, "standings");
  assert.deepEqual(snapshot.data, response);
  assert.ok(snapshot.collectedAt);
});

test("normalizePeriods preserves round IDs and authoritative start/end times", () => {
  const periods = normalizePeriods({
    periods: [
      { round_id: 23659925, start_time: "2026-11-26 13:46:00", end_time: "2026-11-26 13:46:32", season_id: 23659735, competition_id: 10 },
      { round_id: "23659916", start_time: "2026-11-26 13:44:00", end_time: "2026-11-26 13:44:32", season_id: "23659735", competition_id: 10 }
    ]
  });

  assert.equal(periods.length, 2);
  assert.equal(periods[0].roundId, "23659916");
  assert.equal(periods[0].startTime, "2026-11-26 13:44:00");
  assert.equal(periods[0].endTime, "2026-11-26 13:44:32");
  assert.equal(periods[0].seasonId, "23659735");
});

test("getNextUpcomingPeriod selects the next future round using API timezone", () => {
  const periods = normalizePeriods({
    periods: [
      { round_id: "past", start_time: "2026-11-26 13:42:00", end_time: "2026-11-26 13:42:32" },
      { round_id: "next", start_time: "2026-11-26 13:44:00", end_time: "2026-11-26 13:44:32" },
      { round_id: "later", start_time: "2026-11-26 13:46:00", end_time: "2026-11-26 13:46:32" }
    ]
  });

  const now = new Date("2026-11-26T11:43:00.000Z");
  assert.equal(getNextUpcomingPeriod(periods, now).roundId, "next");
});
