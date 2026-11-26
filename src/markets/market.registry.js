/**
 * Canonical market catalogue.
 * These are internal market keys, not confirmed PlayBetMan subtype IDs.
 * Store provider IDs separately when they are discovered from Network requests.
 */
const MARKET_REGISTRY = Object.freeze({
  "1X2": {
    key: "1X2",
    name: "Match Result",
    outcomes: ["HOME", "DRAW", "AWAY"],
    labels: { HOME: "Home", DRAW: "Draw", AWAY: "Away" },
  },
  BTTS: {
    key: "BTTS",
    name: "Both Teams To Score",
    outcomes: ["YES", "NO"],
    labels: { YES: "Yes", NO: "No" },
  },
  "1X2_BTTS": {
    key: "1X2_BTTS",
    name: "1X2 + Both Teams To Score",
    outcomes: ["HOME_YES", "HOME_NO", "DRAW_YES", "DRAW_NO", "AWAY_YES", "AWAY_NO"],
    labels: {
      HOME_YES: "Home + Yes",
      HOME_NO: "Home + No",
      DRAW_YES: "Draw + Yes",
      DRAW_NO: "Draw + No",
      AWAY_YES: "Away + Yes",
      AWAY_NO: "Away + No",
    },
  },
  OVER_UNDER_1_5: {
    key: "OVER_UNDER_1_5",
    name: "Over/Under 1.5 Goals",
    outcomes: ["OVER", "UNDER"],
    labels: { OVER: "Over 1.5", UNDER: "Under 1.5" },
    line: 1.5,
  },
  DOUBLE_CHANCE: {
    key: "DOUBLE_CHANCE",
    name: "Double Chance",
    outcomes: ["1X", "12", "X2"],
    labels: { "1X": "Home or Draw", "12": "Home or Away", X2: "Draw or Away" },
  },
});

function getMarket(marketKey) {
  return MARKET_REGISTRY[marketKey] || null;
}

function listMarkets() {
  return Object.values(MARKET_REGISTRY);
}

module.exports = { MARKET_REGISTRY, getMarket, listMarkets };
