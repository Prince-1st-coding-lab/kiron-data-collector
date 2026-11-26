const playBetMan = require("../clients/playbetman.client");
const { collectMatchesForMarkets } = require("./matches.collector");
const { normalizePeriods } = require("../normalizers/periods.normalizer");
const { saveRawResponse, saveNormalizedData } = require("../services/storage.service");
const { generatePredictionsForRound } = require("../services/prediction.service");

const TIMEZONE = process.env.PLAYBETMAN_TIMEZONE || "Africa/Johannesburg";
const processedRoundIds = new Set();
let lastPeriodsSignature = "";
let activeRound = null;

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
  return periods.find((period) => {
    if (!period.startTime) return false;
    return String(period.startTime) >= nowText ||
      (period.endTime && String(period.startTime) < nowText && String(period.endTime) >= nowText);
  }) || null;
}

function isRoundLive(period, now = new Date()) {
  if (!period?.startTime || !period?.endTime) return false;
  const nowText = formatInTimezone(now, TIMEZONE);
  return String(period.startTime) <= nowText && String(period.endTime) >= nowText;
}

function selectTargetRounds(periods, now = new Date()) {
  const nowText = formatInTimezone(now, TIMEZONE);
  const live = periods.find((period) =>
    period.startTime && period.endTime &&
    String(period.startTime) <= nowText && String(period.endTime) >= nowText
  ) || (isRoundLive(activeRound, now) ? activeRound : null);

  if (live) {
    const next = periods.find((period) => period.startTime && String(period.startTime) > String(live.endTime));
    return [live, next].filter(Boolean);
  }

  return periods.filter((period) => period.startTime && String(period.startTime) >= nowText).slice(0, 2);
}

async function collectOneRound(round, competitionId, marketTypes) {
  if (processedRoundIds.has(String(round.roundId))) {
    return { round, skipped: true, matches: 0, predictions: 0 };
  }

  console.log("Preparing round " + round.roundId + " | starts " + round.startTime + " | ends " + round.endTime);
  const collected = await collectMatchesForMarkets({
    round_id: round.roundId,
    competition_id: round.competitionId || competitionId,
    marketTypes,
    tab: "",
  });

  if (!collected.totalMatches) {
    return {
      round,
      matches: 0,
      retrying: true,
      reason: "The API returned no fixtures yet; this round will be retried on the next poll.",
    };
  }

  const predictionRun = generatePredictionsForRound(round.roundId, collected.matches, round);
  processedRoundIds.add(String(round.roundId));
  return {
    round,
    matches: collected.totalMatches,
    matchesFile: collected.normalizedFile,
    predictions: predictionRun.predictions.length,
    predictionsFile: predictionRun.filePath,
  };
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
  const periods = normalizePeriods(response).sort((a, b) =>
    String(a.startTime || "").localeCompare(String(b.startTime || ""))
  );

  const signature = JSON.stringify(periods);
  let periodsFile = null;
  if (signature !== lastPeriodsSignature) {
    saveRawResponse("periods", response);
    periodsFile = saveNormalizedData("periods", periods);
    lastPeriodsSignature = signature;
  }

  const targets = selectTargetRounds(periods);
  activeRound = targets.find((period) => isRoundLive(period)) ||
    targets[0] || (isRoundLive(activeRound) ? activeRound : null);

  if (!targets.length) {
    return { periodsFile, totalPeriods: periods.length, round: null, rounds: [], reason: "No current or upcoming rounds were returned." };
  }

  const marketTypes = (process.env.MARKET_SUB_TYPES || subTypeId)
    .split(",").map((value) => value.trim()).filter(Boolean);

  const rounds = [];
  for (const target of targets) {
    rounds.push(await collectOneRound(target, competitionId, marketTypes));
  }

  const processed = rounds.filter((item) => !item.skipped);
  return {
    periodsFile,
    totalPeriods: periods.length,
    round: activeRound || targets[0],
    rounds,
    matches: processed.reduce((sum, item) => sum + (item.matches || 0), 0),
    predictions: processed.reduce((sum, item) => sum + (item.predictions || 0), 0),
    retrying: rounds.some((item) => item.retrying),
    reason: rounds.find((item) => item.reason)?.reason || null,
  };
}

function getActiveRound() {
  return activeRound;
}

module.exports = {
  collectNextRound,
  getNextUpcomingPeriod,
  formatInTimezone,
  isRoundLive,
  getActiveRound,
  selectTargetRounds,
};
