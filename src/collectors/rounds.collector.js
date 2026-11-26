const fs = require("fs");
const path = require("path");
const playBetMan = require("../clients/playbetman.client");
const { collectMatches } = require("./matches.collector");
const { normalizePeriods } = require("../normalizers/periods.normalizer");
const { saveRawResponse, saveNormalizedData } = require("../services/storage.service");
const { generatePredictionsForRound } = require("../services/prediction.service");

const DATA_DIR = path.join(process.cwd(), "data", "normalized");
const TIMEZONE = process.env.PLAYBETMAN_TIMEZONE || "Africa/Johannesburg";
const processedRoundIds = new Set();

function formatInTimezone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return values.year + "-" + values.month + "-" + values.day + " " +
    values.hour + ":" + values.minute + ":" + values.second;
}

function getNextUpcomingPeriod(periods, now = new Date()) {
  const nowText = formatInTimezone(now, TIMEZONE);
  return periods.find((period) =>
    period.startTime &&
    String(period.startTime) >= nowText
  ) || null;
}

async function collectNextRound() {
  const competitionId = Number(process.env.COMPETITION_ID);
  const subTypeId = process.env.MARKET_TYPE || "1X2";

  if (!Number.isInteger(competitionId) || competitionId <= 0) {
    throw new Error("Set a valid COMPETITION_ID in .env.");
  }

  const response = await playBetMan.fetchPeriods({
    period: "",
    competition_id: competitionId,
    sub_type_id: subTypeId,
    tab: "",
  });

  saveRawResponse("periods", response);
  const periods = normalizePeriods(response);
  const periodsFile = saveNormalizedData("periods", periods);

  const nextPeriod = getNextUpcomingPeriod(periods);
  if (!nextPeriod) {
    return { periodsFile, totalPeriods: periods.length, round: null, reason: "No upcoming round was returned." };
  }

  if (processedRoundIds.has(nextPeriod.roundId)) {
    return { periodsFile, totalPeriods: periods.length, round: nextPeriod, skipped: true };
  }

  console.log(
    "Next round: " + nextPeriod.roundId +
    " | starts " + nextPeriod.startTime +
    " | ends " + nextPeriod.endTime
  );

  const collected = await collectMatches({
    round_id: nextPeriod.roundId,
    competition_id: nextPeriod.competitionId || competitionId,
    sub_type_id: subTypeId,
    tab: "",
  });

  if (!collected.totalMatches) {
    return {
      periodsFile,
      totalPeriods: periods.length,
      round: nextPeriod,
      matches: 0,
      retrying: true,
      reason: "The API returned no fixtures yet; this round will be retried on the next poll.",
    };
  }

  const predictionRun = generatePredictionsForRound(
    nextPeriod.roundId,
    collected.matches,
    nextPeriod
  );

  processedRoundIds.add(nextPeriod.roundId);

  return {
    periodsFile,
    totalPeriods: periods.length,
    round: nextPeriod,
    matches: collected.totalMatches,
    matchesFile: collected.normalizedFile,
    predictions: predictionRun.predictions.length,
    predictionsFile: predictionRun.filePath,
    predictionReason: predictionRun.reason || null,
  };
}

module.exports = { collectNextRound, getNextUpcomingPeriod, formatInTimezone };
