# Kiron / PlayBetMan Data Collector

A Node.js 18+ application that collects authorized PlayBetMan football fixtures, results and standings, preserves original API responses, and writes normalized JSON datasets for downstream analysis.

## Features

- Shared Axios client for the tested PlayBetMan league endpoints.
- Scheduled collection of fixtures/markets, results and standings.
- Raw timestamped JSON archives under `data/raw/`.
- Normalized fixture and result records under `data/normalized/`.
- Live and standings snapshots are preserved without guessing undocumented response fields.
- Unified dataset joins fixture and result records by match ID and includes the latest live and standings snapshots when available.
- Automated unit tests for the normalizers.
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

The example IDs are placeholders/defaults from testing. Confirm that they are still valid for the competition you are collecting.

## Run

Test API connectivity:

```bash
npm run test:connection
```

Run unit tests:

```bash
npm test
```

Start the scheduler:

```bash
npm run dev
```

For a normal production process, use `npm start` under a persistent Node.js worker or process manager. This is a long-running collector, not a static website deployment.

## Data output

```text
data/
  raw/             # complete original API responses
  normalized/
    matches-*.json # normalized fixtures and market outcomes
    results-*.json # one normalized record per completed match
    live-*.json    # timestamped live response snapshot
    standings-*.json
    unified-*.json # joined fixtures/results plus latest snapshots
```

The unified dataset is regenerated after each successful scheduled collection. Match records are joined by `matchId`. If the API does not return a match ID, records cannot be reliably joined and are retained separately.

Live collection is implemented as a callable collector, but is not scheduled automatically: its endpoint requires explicit `period`, `end_time` and `round_id` values. The unified dataset includes the latest live snapshot after one has been collected.

## Data integrity and limitations

- Raw API responses are retained so future normalizer improvements can be made without recollecting historical data.
- The live and standings response structures have not yet been supplied as representative samples. They are preserved as snapshots rather than mapped to invented field names.
- The unified JSON file combines the latest saved files. It is a convenient working dataset, not a transactional database or a guaranteed complete historical warehouse.
- Polling intervals are configurable starting values, not confirmed API rate limits. Respect the service's access rules and avoid excessive requests.
- This project does not calculate betting predictions or guarantee outcomes. It prepares collected data for later statistical analysis.
- Keep account-specific responses, session URLs, cookies and tokens private.
