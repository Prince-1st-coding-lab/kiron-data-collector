const cron = require("node-cron");
const { collectResults } = require("../collectors/results.collector");
const { collectStandings } = require("../collectors/standings.collector");
const { collectNextRound, getActiveRound, isRoundLive } = require("../collectors/rounds.collector");
const { collectLive } = require("../collectors/live.collector");
const { buildUnifiedDataset } = require("../services/dataset.service");

const competition_id = Number(process.env.COMPETITION_ID);

function everyMinutes(value, fallback) {
  const minutes = Number(value || fallback);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 59) {
    throw new Error("Collection intervals must be whole minutes between 1 and 59.");
  }
  return minutes;
}

async function runCollection(name, task) {
  try {
    console.log("Starting " + name + " collection...");
    await task();
    console.log(name + " collection completed.");

    const unified = buildUnifiedDataset();
    console.log("Unified dataset saved: " + unified.filePath);
  } catch (error) {
    console.error(name + " collection failed: " + error.message);
  }
}

let roundPollRunning = false;
let livePollRunning = false;

async function runRoundDiscovery() {
  if (roundPollRunning) return;
  roundPollRunning = true;
  try {
    const result = await collectNextRound();
    if (result.retrying) {
      console.log("Round " + result.round.roundId + " is not ready yet: " + result.reason);
    } else if (result.round && !result.skipped) {
      console.log(
        "Round " + result.round.roundId + " processed: " +
        result.matches + " fixtures, " + result.predictions + " predictions."
      );
    }
  } catch (error) {
    console.error("Round discovery failed: " + error.message);
  } finally {
    roundPollRunning = false;
  }
}

async function runLivePolling() {
  if (livePollRunning) return;
  const round = getActiveRound();
  if (!round || !isRoundLive(round)) return;

  livePollRunning = true;
  try {
    const snapshot = await collectLive({
      period: round.startTime,
      end_time: round.endTime,
      competition_id: round.competitionId || competition_id,
      round_id: round.roundId,
      sub_type_id: process.env.MARKET_TYPE || "1X2",
      tab: "",
    });
    console.log(
      "Live update: round " + round.roundId +
      " | collected " + snapshot.collectedAt
    );
  } catch (error) {
    console.error("Live polling failed for round " + round.roundId + ": " + error.message);
  } finally {
    livePollRunning = false;
  }
}

function startScheduler() {
  if (!Number.isInteger(competition_id) || competition_id <= 0) {
    throw new Error("Set a valid COMPETITION_ID in .env.");
  }

  const resultsInterval = everyMinutes(process.env.RESULTS_INTERVAL_MINUTES, 1);
  const standingsInterval = everyMinutes(process.env.STANDINGS_INTERVAL_MINUTES, 30);
  const roundPollSeconds = Number(process.env.ROUND_POLL_INTERVAL_SECONDS || 5);
  const livePollSeconds = Number(process.env.LIVE_POLL_INTERVAL_SECONDS || 2);

  if (!Number.isInteger(roundPollSeconds) || roundPollSeconds < 2 || roundPollSeconds > 120) {
    throw new Error("ROUND_POLL_INTERVAL_SECONDS must be a whole number between 2 and 120.");
  }
  if (!Number.isInteger(livePollSeconds) || livePollSeconds < 1 || livePollSeconds > 10) {
    throw new Error("LIVE_POLL_INTERVAL_SECONDS must be a whole number between 1 and 10.");
  }

  const resultsTask = () => collectResults(competition_id);
  const standingsTask = () => collectStandings(competition_id);

  cron.schedule("*/" + resultsInterval + " * * * *", () => runCollection("Results", resultsTask));
  cron.schedule("*/" + standingsInterval + " * * * *", () => runCollection("Standings", standingsTask));

  console.log("Dynamic round scheduler started.");
  console.log("Round timeline: /league/fetchP every " + roundPollSeconds + " seconds");
  console.log("Live scores: /league/fetchLive every " + livePollSeconds + " seconds during active rounds");
  console.log("Results: every " + resultsInterval + " minute(s) | Standings: every " + standingsInterval + " minutes");
  console.log("Competition ID: " + competition_id + " | Round IDs and times are read from the API.");

  runRoundDiscovery();
  setInterval(runRoundDiscovery, roundPollSeconds * 1000);
  setInterval(runLivePolling, livePollSeconds * 1000);
  runCollection("Results", resultsTask);
  runCollection("Standings", standingsTask);
}

module.exports = { startScheduler };
