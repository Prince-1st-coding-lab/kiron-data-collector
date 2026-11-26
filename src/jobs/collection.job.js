const cron = require("node-cron");
const { collectMatches } = require("../collectors/matches.collector");
const { collectResults } = require("../collectors/results.collector");
const { collectStandings } = require("../collectors/standings.collector");

const competition_id = Number(process.env.COMPETITION_ID);
const round_id = process.env.ROUND_ID;
const sub_type_id = process.env.MARKET_TYPE || "1X2";

function everyMinutes(value, fallback) {
  const minutes = Number(value || fallback);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 59) {
    throw new Error("Collection intervals must be whole minutes between 1 and 59.");
  }
  return minutes;
}

async function runCollection(name, task) {
  try {
    console.log(`Starting ${name} collection...`);
    await task();
    console.log(`${name} collection completed.`);
  } catch (error) {
    console.error(`${name} collection failed: ${error.message}`);
  }
}

function startScheduler() {
  if (!Number.isInteger(competition_id) || competition_id <= 0 || !round_id) {
    throw new Error("Set valid COMPETITION_ID and ROUND_ID in .env.");
  }

  const matchesInterval = everyMinutes(process.env.MATCHES_INTERVAL_MINUTES, 10);
  const resultsInterval = everyMinutes(process.env.RESULTS_INTERVAL_MINUTES, 10);
  const standingsInterval = everyMinutes(process.env.STANDINGS_INTERVAL_MINUTES, 30);

  const matchesTask = () => collectMatches({ round_id, competition_id, sub_type_id });
  const resultsTask = () => collectResults(competition_id);
  const standingsTask = () => collectStandings(competition_id);

  cron.schedule(`*/${matchesInterval} * * * *`, () => runCollection("Matches", matchesTask));
  cron.schedule(`*/${resultsInterval} * * * *`, () => runCollection("Results", resultsTask));
  cron.schedule(`*/${standingsInterval} * * * *`, () => runCollection("Standings", standingsTask));

  console.log("Scheduler started.");
  console.log(`Matches: every ${matchesInterval} minutes | Results: every ${resultsInterval} minutes | Standings: every ${standingsInterval} minutes`);

  // Run one initial collection cycle at startup.
  runCollection("Matches", matchesTask);
  runCollection("Results", resultsTask);
  runCollection("Standings", standingsTask);
}

module.exports = { startScheduler };
