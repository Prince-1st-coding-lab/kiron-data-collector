const { MARKET_REGISTRY } = require("./market.registry");

const MAX_GOALS = 8;

function poissonProbability(lambda, goals) {
  let factorial = 1;
  for (let i = 2; i <= goals; i++) factorial *= i;
  return (Math.exp(-lambda) * Math.pow(lambda, goals)) / factorial;
}

function percentage(value) {
  return Number((value * 100).toFixed(1));
}

/**
 * Build all requested markets from one shared scoreline probability matrix.
 * Probabilities are normalized over the 0..MAX_GOALS score grid.
 */
function calculateMarketProbabilities(homeLambda, awayLambda) {
  if (!Number.isFinite(homeLambda) || homeLambda < 0 ||
      !Number.isFinite(awayLambda) || awayLambda < 0) {
    throw new TypeError("Expected goals must be finite non-negative numbers.");
  }

  const matrix = [];
  let totalMass = 0;

  for (let home = 0; home <= MAX_GOALS; home++) {
    for (let away = 0; away <= MAX_GOALS; away++) {
      const probability = poissonProbability(homeLambda, home) *
        poissonProbability(awayLambda, away);
      matrix.push({ home, away, probability });
      totalMass += probability;
    }
  }

  if (!totalMass) throw new Error("Could not calculate a scoreline probability distribution.");

  const p = { home: 0, draw: 0, away: 0, bttsYes: 0, over15: 0 };
  for (const score of matrix) {
    const probability = score.probability / totalMass;
    if (score.home > score.away) p.home += probability;
    else if (score.home === score.away) p.draw += probability;
    else p.away += probability;

    if (score.home > 0 && score.away > 0) p.bttsYes += probability;
    if (score.home + score.away >= 2) p.over15 += probability;
  }

  const bttsNo = 1 - p.bttsYes;
  const under15 = 1 - p.over15;
  const markets = {
    "1X2": {
      outcomes: {
        HOME: percentage(p.home),
        DRAW: percentage(p.draw),
        AWAY: percentage(p.away),
      },
    },
    BTTS: {
      outcomes: { YES: percentage(p.bttsYes), NO: percentage(bttsNo) },
    },
    "1X2_BTTS": {
      outcomes: {
        HOME_YES: percentage(p.home * 0 + matrix.reduce((sum, s) =>
          sum + (s.home > s.away && s.home > 0 && s.away > 0 ? s.probability / totalMass : 0), 0)),
        HOME_NO: percentage(matrix.reduce((sum, s) =>
          sum + (s.home > s.away && !(s.home > 0 && s.away > 0) ? s.probability / totalMass : 0), 0)),
        DRAW_YES: percentage(matrix.reduce((sum, s) =>
          sum + (s.home === s.away && s.home > 0 && s.away > 0 ? s.probability / totalMass : 0), 0)),
        DRAW_NO: percentage(matrix.reduce((sum, s) =>
          sum + (s.home === s.away && !(s.home > 0 && s.away > 0) ? s.probability / totalMass : 0), 0)),
        AWAY_YES: percentage(matrix.reduce((sum, s) =>
          sum + (s.home < s.away && s.home > 0 && s.away > 0 ? s.probability / totalMass : 0), 0)),
        AWAY_NO: percentage(matrix.reduce((sum, s) =>
          sum + (s.home < s.away && !(s.home > 0 && s.away > 0) ? s.probability / totalMass : 0), 0)),
      },
    },
    OVER_UNDER_1_5: {
      outcomes: { OVER: percentage(p.over15), UNDER: percentage(under15) },
    },
    DOUBLE_CHANCE: {
      outcomes: {
        "1X": percentage(p.home + p.draw),
        "12": percentage(p.home + p.away),
        X2: percentage(p.draw + p.away),
      },
    },
  };

  for (const [key, market] of Object.entries(markets)) {
    const definition = MARKET_REGISTRY[key];
    market.name = definition.name;
    market.outcomes = Object.fromEntries(
      definition.outcomes.map((outcome) => [outcome, market.outcomes[outcome]])
    );
    market.bestOutcome = Object.entries(market.outcomes)
      .sort((a, b) => b[1] - a[1])[0][0];
  }

  return markets;
}

module.exports = { calculateMarketProbabilities };
