# Kiron / PlayBetMan Data Collector & Prediction Engine

A Node.js 18+ collector for authorized PlayBetMan football data. It discovers upcoming virtual-football rounds from the API, fetches each round's fixtures, preserves raw responses, collects completed results and generates round-specific statistical predictions.

## Features

- Calls `/league/fetchP` to discover the available round timeline.
- Uses API-provided `round_id`, `start_time`, `end_time`, `season_id` and `competition_id`; it never guesses round IDs.
- Polls the timeline automatically and fetches fixtures for the next upcoming round.
- Polls `/league/fetchLive` every 2 seconds while the selected round is active (configurable).
- Saves live snapshots tagged with their round ID and scheduled start/end times.
- Exposes the latest live response to the dashboard beside each prediction; field-level score rendering depends on the actual live response schema.
- Retries a round if its fixtures are not available yet.
- Generates predictions tagged with the exact target round ID and its scheduled times.
- Refreshes completed results every minute by default.
- Stores timestamped raw and normalized JSON archives.
- Uses a venue-adjusted independent Poisson baseline to estimate expected goals and derive 1X2, BTTS, 1X2 + BTTS, Over/Under 1.5 and Double Chance probabilities.
- Uses a modular market registry and shared scoreline probability distribution; each fixture has one identity and one actual score across all markets.
- Keeps previous completed rounds available as prediction history.
- Includes a local dashboard and automated tests.

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

Copy `.env.example` to `.env`, then set your actual league page URL. Do not share or commit the real `.env` file, cookies, session URLs or tokens.

## Configuration

| Variable | Purpose |
| --- | --- |
| `PLAYBETMAN_BASE_URL` | API host, normally `https://lite.playbetman.com` |
| `PLAYBETMAN_LEAGUE_URL` | Actual league page URL used by the tested requests |
| `PLAYBETMAN_TIMEZONE` | Timezone sent to the API and used to interpret round times |
| `COMPETITION_ID` | Competition identifier; the supplied timeline example uses `10` |
| `MARKET_TYPE` | Market code used for round timeline and live polling; default `1X2` |\n| `MARKET_SUB_TYPES` | Comma-separated verified provider subtype IDs fetched for each round; defaults to `MARKET_TYPE` |
| `ROUND_POLL_INTERVAL_SECONDS` | How often to call `/league/fetchP`; default `5` |
| `LIVE_POLL_INTERVAL_SECONDS` | How often to call `/league/fetchLive` during an active round; default `2` |
| `RESULTS_INTERVAL_MINUTES` | Completed-results refresh interval; default `1` |
| `STANDINGS_INTERVAL_MINUTES` | Standings refresh interval; default `30` |
| `MAX_PREVIOUS_ROUNDS` | Number of newest completed rounds used as prediction history; default `5` |

The old fixed `ROUND_ID`, `MATCHES_REQUEST_ROUND_ID` and `CURRENT_ROUND_ID` settings are no longer required by the automatic scheduler.

## Run

```bash
npm install
npm test
npm run dev
```

Open `http://localhost:3000` for the dashboard.

## Round discovery workflow

Every poll sends the verified empty-period request to `/league/fetchP`. The collector normalizes the returned `periods[]`, orders them by `start_time`, selects the next upcoming period using `PLAYBETMAN_TIMEZONE`, and calls `/league/fetchMatches` with that period's exact `round_id` and `competition_id`.

The prediction output stores `roundId`, `roundStartTime`, `roundEndTime`, `seasonId` and `competitionId`. Fixture records use the selected API round ID as `roundId`; the source's separate match-level round value is retained as `sourceRoundId`.

## Data output

```text
data/
  raw/                    # complete original API responses
  normalized/
    periods-*.json        # available round timeline snapshots
    matches-*.json        # normalized fixtures and market outcomes
    results-*.json        # normalized completed matches
    live-*.json           # live response snapshots
    standings-*.json      # standings snapshots
    unified-*.json        # latest fixtures/results plus snapshots
    predictions-*.json    # round-specific statistical predictions
```

## Prediction model

The current model is a transparent statistical baseline, not a trained machine-learning model. It:

1. Reads normalized completed-result archives and deduplicates records.
2. Excludes the target round and selects the newest configured number of previous rounds.
3. Calculates home-team home scoring/conceding rates and away-team away scoring/conceding rates.
4. Smooths sparse team rates toward competition averages using a three-match prior.
5. Estimates expected goals and builds one shared independent-Poisson scoreline distribution.
6. Derives market probabilities from that distribution for 1X2, BTTS, 1X2 + BTTS, Over/Under 1.5 and Double Chance.

Predictions are estimates, not guarantees. The model does not currently incorporate player availability, injuries, weather or verified live data. Insufficient history is reported rather than fabricated.

## Notes

- API-provided start/end times are treated as authoritative; the collector does not calculate round IDs or round schedules.
- The scheduler discovers the next upcoming round, fetches its fixtures, and keeps that round active through its API-provided start/end window. During the active window it polls `/league/fetchLive` with `period=start_time` and `end_time=end_time`. It does not fetch live data outside the round window.
- Polling intervals are configurable starting values, not confirmed API rate limits. Respect the service's access rules.
- This project does not guarantee betting outcomes.


## Modular market architecture

Market definitions live in `src/markets/market.registry.js`; probability calculations live in `src/markets/market.calculators.js`. The prediction service attaches a `markets` object to each estimated fixture while retaining the existing top-level `probabilities` fields for backward compatibility.

Supported internal market keys:

- `1X2`: HOME, DRAW, AWAY
- `BTTS`: YES, NO
- `1X2_BTTS`: HOME_YES, HOME_NO, DRAW_YES, DRAW_NO, AWAY_YES, AWAY_NO
- `OVER_UNDER_1_5`: OVER, UNDER
- `DOUBLE_CHANCE`: 1X, 12, X2

These are internal canonical keys, not confirmed PlayBetMan `sub_type_id` values. The collector supports multiple provider subtype IDs through `MARKET_SUB_TYPES` and merges their responses by match ID. Set this variable only after capturing each exact `sub_type_id` from the PlayBetMan Network requests; do not assume canonical market names are valid provider IDs. Each raw response is archived, and each normalized market retains its requested provider subtype.

All market probabilities are derived from the same truncated 0..8 independent-Poisson scoreline grid and normalized to 100%. Combination market outcomes are mutually exclusive. These are model probabilities, not bookmaker odds or guaranteed outcomes. The current market calculations do not yet consume market-specific odds.

