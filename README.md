# Kiron / PlayBetMan Data Collector & Prediction Engine

A Node.js 18+ application that collects authorized PlayBetMan football fixtures, results and standings, preserves original API responses, and writes normalized JSON datasets for downstream statistical analysis.

## Features

- Shared Axios client for the tested PlayBetMan league endpoints.
- Scheduled collection of fixtures/markets, results and standings.
- Raw timestamped JSON archives under `data/raw/`.
- Normalized fixture and result records under `data/normalized/`.
- Live and standings snapshots are preserved without guessing undocumented response fields.
- Unified dataset joins fixture and result records by match ID.
- Venue-adjusted independent Poisson baseline for 1X2 probabilities and expected goals.
- Historical result files are deduplicated by match ID before analysis.
- Automated unit tests for normalizers and prediction calculations.
- Secrets and collected data are excluded from Git.

## Requirements

- Node.js 18 or newer
- npm
- A valid league page URL and authorized access to the PlayBetMan API

## Installation

```bash
git clone https://github.com/Prince-1st-coding-lab/kiron-data-collector.git
cd kiron-data-collector
npm install
```

Copy `.env.example` to `.env` and enter your actual league page URL and verified IDs. Do not share or commit the real `.env` file.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PLAYBETMAN_BASE_URL` | API host, normally `https://lite.playbetman.com` |
| `PLAYBETMAN_LEAGUE_URL` | Actual league page URL used by the tested requests |
| `PLAYBETMAN_TIMEZONE` | Timezone sent to the API |
| `COMPETITION_ID` | Competition identifier |
| `ROUND_ID` | Round identifier used by `fetchMatches` |
| `MARKET_TYPE` | Market code, e.g. `1X2` |
| `MATCHES_INTERVAL_MINUTES` | Fixture and market polling interval |
| `RESULTS_INTERVAL_MINUTES` | Results polling interval |
| `STANDINGS_INTERVAL_MINUTES` | Standings polling interval |

Confirm that competition and round IDs are current before running. Never commit your real `.env`, cookies, session URLs or tokens.

## Run

```bash
npm install
npm test
npm run test:connection
npm run dev
```

The scheduler collects fixtures, results and standings. After a successful collection it rebuilds the unified dataset and generates predictions when usable historical results exist.

Generate predictions manually:

```bash
npm run predict
```

## Data output

```text
data/
  raw/                    # complete original API responses
  normalized/
    matches-*.json        # normalized fixtures and market outcomes
    results-*.json        # one normalized record per completed match
    live-*.json           # timestamped live response snapshot
    standings-*.json      # timestamped standings snapshot
    unified-*.json        # latest fixtures/results plus snapshots
    predictions-*.json    # model estimates for latest fixtures
```

## Prediction model

The current model is a transparent baseline, not a trained machine-learning model. It:
1. Reads all normalized result archives and deduplicates records.
2. Calculates home-team home scoring/conceding rates and away-team away scoring/conceding rates.
3. Smooths sparse team rates toward competition averages using a three-match prior.
4. Estimates expected goals for each upcoming fixture.
5. Uses independent Poisson goal probabilities to estimate home-win, draw and away-win probabilities.

Each prediction includes expected goals, 1X2 percentages, the most likely scoreline, and sample-size context. Probabilities are estimates, not guarantees. The model currently does not use market odds, player availability, injuries, weather, or verified live/standings fields. It requires a meaningful completed-results history; insufficient data is reported rather than fabricated.

## Live collection limitation

Live collection remains a callable collector, not an automatic scheduled job. Its endpoint requires explicit `period`, `end_time` and `round_id` values. The live and standings payloads are preserved as snapshots until representative schemas are verified.

## Data integrity

- Raw API responses are retained for future normalizer improvements.
- Unified JSON is a working snapshot, not a transactional database or guaranteed complete historical warehouse.
- Polling intervals are configurable starting values, not confirmed API rate limits. Respect the service's access rules.
- This project does not guarantee betting outcomes.
