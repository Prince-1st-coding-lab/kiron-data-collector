const fs = require("fs");
const path = require("path");
const { saveNormalizedData } = require("./storage.service");
const { calculateMarketProbabilities } = require("../markets/market.calculators");

const DATA_DIR = path.join(process.cwd(), "data", "normalized");
const PRIOR_MATCHES = 3;
const MAX_GOALS = 8;

function getPredictionConfig() {
  const currentRoundId = String(process.env.CURRENT_ROUND_ID || process.env.ROUND_ID || "").trim();
  const maxPreviousRounds = Number(process.env.MAX_PREVIOUS_ROUNDS || 5);
  if (!currentRoundId) throw new Error("Set CURRENT_ROUND_ID or ROUND_ID to the round being predicted.");
  if (!Number.isInteger(maxPreviousRounds) || maxPreviousRounds < 1) {
    throw new Error("MAX_PREVIOUS_ROUNDS must be a positive whole number.");
  }
  return { currentRoundId, maxPreviousRounds };
}

function selectPreviousRounds(results, currentRoundId, maxPreviousRounds) {
  const roundDates = new Map();
  for (const match of results) {
    if (!match.roundId || String(match.roundId) === String(currentRoundId)) continue;
    const roundId = String(match.roundId);
    const timestamp = match.startTime ? new Date(String(match.startTime).replace(" ", "T")).getTime() : 0;
    const previous = roundDates.get(roundId) || 0;
    if (Number.isFinite(timestamp) && timestamp > previous) roundDates.set(roundId, timestamp);
    else if (!roundDates.has(roundId)) roundDates.set(roundId, 0);
  }
  const selectedRoundIds = [...roundDates.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxPreviousRounds)
    .map(([roundId]) => roundId);
  const selected = new Set(selectedRoundIds);
  return {
    results: results.filter((match) => match.roundId != null && selected.has(String(match.roundId))),
    selectedRoundIds,
  };
}

function validResult(match) {
  return match &&
    typeof match.homeTeam === "string" &&
    typeof match.awayTeam === "string" &&
    Number.isInteger(match.homeScore) &&
    Number.isInteger(match.awayScore) &&
    match.homeScore >= 0 &&
    match.awayScore >= 0;
}

function readHistoricalResults(directory = DATA_DIR) {
  if (!fs.existsSync(directory)) return [];
  const files = fs.readdirSync(directory)
    .filter((name) => name.startsWith("results-") && name.endsWith(".json"))
    .sort();

  const unique = new Map();
  for (const file of files) {
    const records = JSON.parse(fs.readFileSync(path.join(directory, file), "utf8"));
    if (!Array.isArray(records)) continue;

    for (const match of records) {
      if (!validResult(match)) continue;
      const key = match.matchId
        ? String(match.matchId)
        : [match.startTime, match.homeTeam, match.awayTeam].join("|");
      unique.set(key, match);
    }
  }
  return [...unique.values()];
}

function average(total, count, priorAverage, priorMatches = PRIOR_MATCHES) {
  return (total + priorAverage * priorMatches) / (count + priorMatches);
}

function poissonProbability(lambda, goals) {
  let factorial = 1;
  for (let i = 2; i <= goals; i++) factorial *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial;
}

function calculateOutcomeProbabilities(homeLambda, awayLambda) {
  let home = 0;
  let draw = 0;
  let away = 0;
  let mostLikely = { score: "0-0", probability: -1 };

  for (let h = 0; h <= MAX_GOALS; h++) {
    for (let a = 0; a <= MAX_GOALS; a++) {
      const probability = poissonProbability(homeLambda, h) * poissonProbability(awayLambda, a);
      if (h > a) home += probability;
      else if (h === a) draw += probability;
      else away += probability;

      if (probability > mostLikely.probability) {
        mostLikely = { score: `${h}-${a}`, probability };
      }
    }
  }

  const total = home + draw + away;
  return {
    homeWin: home / total,
    draw: draw / total,
    awayWin: away / total,
    mostLikelyScore: mostLikely.score,
  };
}

function buildTeamStats(results) {
  const teams = new Map();
  let homeGoals = 0;
  let awayGoals = 0;

  function ensure(name) {
    if (!teams.has(name)) {
      teams.set(name, {
        home: { played: 0, scored: 0, conceded: 0 },
        away: { played: 0, scored: 0, conceded: 0 },
        recent: [],
      });
    }
    return teams.get(name);
  }

  const orderedResults = results.filter(validResult).slice().sort((a, b) =>
    String(a.startTime || "").localeCompare(String(b.startTime || ""))
  );
  for (const match of orderedResults) {
    const home = ensure(match.homeTeam);
    const away = ensure(match.awayTeam);

    home.home.played++;
    home.home.scored += match.homeScore;
    home.home.conceded += match.awayScore;

    away.away.played++;
    away.away.scored += match.awayScore;
    away.away.conceded += match.homeScore;

    homeGoals += match.homeScore;
    awayGoals += match.awayScore;

    home.recent.push({ points: match.homeScore > match.awayScore ? 3 : match.homeScore === match.awayScore ? 1 : 0, scored: match.homeScore, conceded: match.awayScore });
    away.recent.push({ points: match.awayScore > match.homeScore ? 3 : match.awayScore === match.homeScore ? 1 : 0, scored: match.awayScore, conceded: match.homeScore });
  }

  const count = results.filter(validResult).length;
  return {
    teams,
    matches: count,
    leagueHomeGoals: count ? homeGoals / count : 0,
    leagueAwayGoals: count ? awayGoals / count : 0,
  };
}

function summarizeRecentForm(matches) {
  const recent = matches.slice(-5);
  if (!recent.length) return { matches: 0, points: 0, pointsPerMatch: 0, goalsScored: 0, goalsConceded: 0 };
  const points = recent.reduce((sum, match) => sum + match.points, 0);
  return {
    matches: recent.length,
    points,
    pointsPerMatch: Number((points / recent.length).toFixed(2)),
    goalsScored: recent.reduce((sum, match) => sum + match.scored, 0),
    goalsConceded: recent.reduce((sum, match) => sum + match.conceded, 0),
  };
}

function buildPredictions(fixtures, historicalResults) {
  const validFixtures = Array.isArray(fixtures)
    ? fixtures.filter((match) =>
        match &&
        typeof match.homeTeam === "string" &&
        typeof match.awayTeam === "string" &&
        match.homeTeam !== match.awayTeam &&
        match.status !== "completed"
      )
    : [];

  const stats = buildTeamStats(Array.isArray(historicalResults) ? historicalResults : []);
  if (!stats.matches || stats.leagueHomeGoals <= 0 || stats.leagueAwayGoals <= 0) {
    return validFixtures.map((fixture) => ({
      matchId: fixture.matchId ?? null,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      status: "insufficient_history",
      reason: "No usable completed-match history is available.",
    }));
  }

  return validFixtures.map((fixture) => {
    const home = stats.teams.get(fixture.homeTeam);
    const away = stats.teams.get(fixture.awayTeam);

    const homeAttack = home?.home || { played: 0, scored: 0, conceded: 0 };
    const homeDefense = homeAttack;
    const awayAttack = away?.away || { played: 0, scored: 0, conceded: 0 };
    const awayDefense = awayAttack;

    const homeScoringRate = average(homeAttack.scored, homeAttack.played, stats.leagueHomeGoals);
    const awayConcedingRate = average(awayDefense.conceded, awayDefense.played, stats.leagueHomeGoals);
    const awayScoringRate = average(awayAttack.scored, awayAttack.played, stats.leagueAwayGoals);
    const homeConcedingRate = average(homeDefense.conceded, homeDefense.played, stats.leagueAwayGoals);

    const expectedHomeGoals = Math.max(0.05,
      (homeScoringRate * awayConcedingRate) / stats.leagueHomeGoals);
    const expectedAwayGoals = Math.max(0.05,
      (awayScoringRate * homeConcedingRate) / stats.leagueAwayGoals);

    const outcomes = calculateOutcomeProbabilities(expectedHomeGoals, expectedAwayGoals);
    const sampleSize = Math.min(homeAttack.played, awayAttack.played);

    return {
      matchId: fixture.matchId ?? null,
      startTime: fixture.startTime ?? null,
      competitionId: fixture.competitionId ?? null,
      homeTeam: fixture.homeTeam,
      awayTeam: fixture.awayTeam,
      status: "estimated",
      expectedHomeGoals: Number(expectedHomeGoals.toFixed(2)),
      expectedAwayGoals: Number(expectedAwayGoals.toFixed(2)),
      probabilities: {
        homeWin: Number((outcomes.homeWin * 100).toFixed(1)),
        draw: Number((outcomes.draw * 100).toFixed(1)),
        awayWin: Number((outcomes.awayWin * 100).toFixed(1)),
      },
      markets: calculateMarketProbabilities(expectedHomeGoals, expectedAwayGoals),
      mostLikelyScore: outcomes.mostLikelyScore,
      historicalMatches: stats.matches,
      homeVenueMatches: homeAttack.played,
      awayVenueMatches: awayAttack.played,
      homeRecentForm: summarizeRecentForm(home?.recent || []),
      awayRecentForm: summarizeRecentForm(away?.recent || []),
      sampleSizeWarning: sampleSize < 5
        ? "Limited venue-specific history; treat this estimate cautiously."
        : null,
    };
  });
}

function generatePredictions() {
  if (!fs.existsSync(DATA_DIR)) {
    return { filePath: null, predictions: [], reason: "No normalized data directory exists." };
  }

  const fixtureFiles = fs.readdirSync(DATA_DIR)
    .filter((name) => name.startsWith("matches-") && name.endsWith(".json"))
    .sort();
  const latestFixtureFile = fixtureFiles.at(-1);

  if (!latestFixtureFile) {
    return { filePath: null, predictions: [], reason: "No normalized fixtures are available." };
  }

  const { currentRoundId, maxPreviousRounds } = getPredictionConfig();
  const allFixtures = JSON.parse(fs.readFileSync(path.join(DATA_DIR, latestFixtureFile), "utf8"));
  const fixtures = Array.isArray(allFixtures)
    ? allFixtures.filter((fixture) => String(fixture.roundId ?? "") === currentRoundId)
    : [];
  const allHistoricalResults = readHistoricalResults();
  const selectedHistory = selectPreviousRounds(allHistoricalResults, currentRoundId, maxPreviousRounds);
  const historicalResults = selectedHistory.results;
  const predictions = buildPredictions(fixtures, historicalResults);

  const output = {
    schemaVersion: 1,
    model: "venue-adjusted-independent-poisson-baseline",
    generatedAt: new Date().toISOString(),
    historicalMatches: historicalResults.length,
    currentRoundId,
    maxPreviousRounds,
    historicalRoundIds: selectedHistory.selectedRoundIds,
    predictions,
  };

  const filePath = saveNormalizedData("predictions", output);
  console.log(`Generated ${predictions.length} fixture predictions from ${historicalResults.length} historical results.`);
  return { filePath, predictions, output };
}


function generatePredictionsForRound(roundId, fixtures, period = {}) {
  if (!roundId) throw new Error("roundId is required to generate round predictions.");

  const maxPreviousRounds = Number(process.env.MAX_PREVIOUS_ROUNDS || 5);
  if (!Number.isInteger(maxPreviousRounds) || maxPreviousRounds < 1) {
    throw new Error("MAX_PREVIOUS_ROUNDS must be a positive whole number.");
  }

  const allHistoricalResults = readHistoricalResults();
  const selectedHistory = selectPreviousRounds(allHistoricalResults, String(roundId), maxPreviousRounds);
  const predictions = buildPredictions(fixtures, selectedHistory.results);

  const output = {
    schemaVersion: 2,
    model: "venue-adjusted-independent-poisson-baseline",
    generatedAt: new Date().toISOString(),
    roundId: String(roundId),
    roundStartTime: period.startTime ?? null,
    roundEndTime: period.endTime ?? null,
    seasonId: period.seasonId ?? null,
    competitionId: period.competitionId ?? null,
    maxPreviousRounds,
    historicalRoundIds: selectedHistory.selectedRoundIds,
    historicalMatches: selectedHistory.results.length,
    predictions,
  };

  const filePath = saveNormalizedData("predictions", output);
  console.log(
    "Generated " + predictions.length + " predictions for round " + roundId +
    " using " + selectedHistory.results.length + " historical matches."
  );

  return { filePath, predictions, output };
}

module.exports = {
  generatePredictionsForRound,
  buildPredictions,
  readHistoricalResults,
  selectPreviousRounds,
  generatePredictions,
};
