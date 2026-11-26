const test = require("node:test");
const assert = require("node:assert/strict");
const { buildPredictions, selectPreviousRounds } = require("../services/prediction.service");

const history = [
  { matchId: "1", homeTeam: "Alpha", awayTeam: "Beta", homeScore: 2, awayScore: 0 },
  { matchId: "2", homeTeam: "Alpha", awayTeam: "Gamma", homeScore: 1, awayScore: 1 },
  { matchId: "3", homeTeam: "Delta", awayTeam: "Beta", homeScore: 0, awayScore: 2 },
  { matchId: "4", homeTeam: "Gamma", awayTeam: "Alpha", homeScore: 1, awayScore: 2 },
  { matchId: "5", homeTeam: "Beta", awayTeam: "Delta", homeScore: 1, awayScore: 0 },
  { matchId: "6", homeTeam: "Delta", awayTeam: "Alpha", homeScore: 0, awayScore: 1 }
];

test("buildPredictions returns normalized probabilities and expected goals", () => {
  const predictions = buildPredictions([
    { matchId: "next-1", homeTeam: "Alpha", awayTeam: "Beta", status: "scheduled" }
  ], history);

  assert.equal(predictions.length, 1);
  assert.equal(predictions[0].status, "estimated");
  assert.ok(predictions[0].expectedHomeGoals > 0);
  assert.ok(predictions[0].expectedAwayGoals > 0);

  const total = Object.values(predictions[0].probabilities)
    .reduce((sum, value) => sum + value, 0);
  assert.ok(Math.abs(total - 100) <= 0.2);
  assert.match(predictions[0].mostLikelyScore, /^\d+-\d+$/);
});

test("buildPredictions reports insufficient history instead of fabricating estimates", () => {
  const predictions = buildPredictions([
    { homeTeam: "Unknown A", awayTeam: "Unknown B" }
  ], []);

  assert.equal(predictions[0].status, "insufficient_history");
  assert.equal(predictions[0].probabilities, undefined);
});

test("buildPredictions skips completed fixtures and invalid team pairings", () => {
  const predictions = buildPredictions([
    { homeTeam: "Alpha", awayTeam: "Beta", status: "completed" },
    { homeTeam: "Alpha", awayTeam: "Alpha", status: "scheduled" }
  ], history);

  assert.equal(predictions.length, 0);
});


test("selectPreviousRounds uses only the newest configured completed rounds", () => {
  const results = [
    { roundId: "old", startTime: "2026-11-01 12:00:00", matchId: "old-1" },
    { roundId: "middle", startTime: "2026-11-10 12:00:00", matchId: "middle-1" },
    { roundId: "recent", startTime: "2026-11-20 12:00:00", matchId: "recent-1" },
    { roundId: "current", startTime: "2026-11-26 12:00:00", matchId: "current-1" }
  ];

  const selected = selectPreviousRounds(results, "current", 2);
  assert.deepEqual(selected.selectedRoundIds, ["recent", "middle"]);
  assert.deepEqual(selected.results.map((match) => match.matchId), ["middle-1", "recent-1"]);
});
