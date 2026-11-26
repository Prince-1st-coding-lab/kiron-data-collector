const test = require("node:test");
const assert = require("node:assert/strict");
const { calculateMarketProbabilities } = require("../markets/market.calculators");
const { listMarkets, getMarket } = require("../markets/market.registry");

test("registry exposes the five requested market families", () => {
  assert.deepEqual(listMarkets().map((market) => market.key), [
    "1X2", "BTTS", "1X2_BTTS", "OVER_UNDER_1_5", "DOUBLE_CHANCE"
  ]);
  assert.equal(getMarket("OVER_UNDER_1_5").line, 1.5);
});

test("each binary and multi-outcome market sums to approximately 100 percent", () => {
  const markets = calculateMarketProbabilities(1.35, 0.95);
  for (const [key, market] of Object.entries(markets)) {
    const total = Object.values(market.outcomes).reduce((sum, value) => sum + value, 0);
    // Double Chance selections overlap, so their three probabilities total 200%, not 100%.
    const expectedTotal = key === "DOUBLE_CHANCE" ? 200 : 100;
    assert.ok(Math.abs(total - expectedTotal) <= 0.3, market.name + " total was " + total);
    assert.ok(market.bestOutcome);
  }
});

test("BTTS and Over/Under probabilities respond to expected goals", () => {
  const low = calculateMarketProbabilities(0.2, 0.2);
  const high = calculateMarketProbabilities(2.2, 1.8);
  assert.ok(high.BTTS.outcomes.YES > low.BTTS.outcomes.YES);
  assert.ok(high.OVER_UNDER_1_5.outcomes.OVER > low.OVER_UNDER_1_5.outcomes.OVER);
});

test("Double Chance is derived consistently from 1X2", () => {
  const markets = calculateMarketProbabilities(1.4, 0.8);
  const oneX = markets["1X2"].outcomes.HOME + markets["1X2"].outcomes.DRAW;
  const twelve = markets["1X2"].outcomes.HOME + markets["1X2"].outcomes.AWAY;
  const xTwo = markets["1X2"].outcomes.DRAW + markets["1X2"].outcomes.AWAY;
  assert.ok(Math.abs(markets.DOUBLE_CHANCE.outcomes["1X"] - oneX) <= 0.2);
  assert.ok(Math.abs(markets.DOUBLE_CHANCE.outcomes["12"] - twelve) <= 0.2);
  assert.ok(Math.abs(markets.DOUBLE_CHANCE.outcomes.X2 - xTwo) <= 0.2);
});

test("invalid expected goals are rejected", () => {
  assert.throws(() => calculateMarketProbabilities(-1, 0.5), /non-negative/);
});
