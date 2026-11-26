const axios = require("axios");

const BASE_URL = process.env.PLAYBETMAN_BASE_URL;
const LEAGUE_URL = process.env.PLAYBETMAN_LEAGUE_URL;
const TIMEZONE = process.env.PLAYBETMAN_TIMEZONE || "Africa/Johannesburg";

if (!BASE_URL || !LEAGUE_URL || LEAGUE_URL.includes("PASTE_YOUR")) {
  throw new Error("Configure PLAYBETMAN_BASE_URL and PLAYBETMAN_LEAGUE_URL in your .env file.");
}

new URL(BASE_URL);
new URL(LEAGUE_URL);

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 20000,
  headers: {
    Accept: "application/json, text/plain, */*",
    "Content-Type": "application/json;charset=UTF-8",
    Origin: BASE_URL,
    Referer: LEAGUE_URL,
    "User-Agent": "Mozilla/5.0"
  }
});

async function post(endpoint, payload = {}) {
  try {
    const response = await api.post(endpoint, {
      ...payload,
      tz: TIMEZONE,
      url: LEAGUE_URL
    });
    return response.data;
  } catch (error) {
    const status = error.response?.status;
    const detail = status ? `HTTP ${status}` : error.message;
    throw new Error(`PlayBetMan request failed [${endpoint}]: ${detail}`);
  }
}

module.exports = {
  fetchPeriods: (payload) => post("/league/fetchP", payload),
  fetchMatches: (payload) => post("/league/fetchMatches", payload),
  fetchResults: (payload) => post("/league/fetchResults", payload),
  fetchLive: (payload) => post("/league/fetchLive", payload),
  fetchStanding: (payload) => post("/league/fetchStanding", payload)
};
