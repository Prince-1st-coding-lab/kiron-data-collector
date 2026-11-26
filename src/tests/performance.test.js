const test = require("node:test");
const assert = require("node:assert/strict");
const { actualMarketOutcomes } = require("../services/performance.service");

test("actual result maps to all five supported market outcomes", () => {
  assert.deepEqual(actualMarketOutcomes({ homeScore: 2, awayScore: 1 }), {
    "1X2": "HOME",
    BTTS: "YES",
    "1X2_BTTS": "HOME_YES",
    OVER_UNDER_1_5: "OVER",
    DOUBLE_CHANCE: ["1X", "12"],
  });
});

test("draw and no-BTTS results map correctly", () => {
  assert.deepEqual(actualMarketOutcomes({ homeScore: 0, awayScore: 0 }), {
    "1X2": "DRAW",
    BTTS: "NO",
    "1X2_BTTS": "DRAW_NO",
    OVER_UNDER_1_5: "UNDER",
    DOUBLE_CHANCE: ["1X", "X2"],
  });
});

test("invalid score cannot be evaluated", () => {
  assert.equal(actualMarketOutcomes({ homeScore: null, awayScore: 1 }), null);
});
