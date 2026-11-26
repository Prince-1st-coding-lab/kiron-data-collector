# Kiron / PlayBetMan Data Collector

A Node.js collector for storing raw responses from the PlayBetMan endpoints that have been tested in this project.

## Features

- Shared Axios client for PlayBetMan
- Collectors for matches/odds, results, live data and standings
- Timestamped raw JSON response storage
- Configurable cron schedules
- Environment-based configuration; secrets are not committed

## Requirements

- Node.js 18 or newer
- Access to the PlayBetMan league page and its authorized API session

## Setup

1. Clone this repository.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Copy `.env.example` to `.env`.
4. Set your actual league page URL in `PLAYBETMAN_LEAGUE_URL`.
5. Confirm the competition and round IDs in `.env`.
6. Test the connection:

   ```bash
   npm run test:connection
   ```

7. Start scheduled collection:

   ```bash
   npm run dev
   ```

## Environment variables

| Variable | Purpose |
| --- | --- |
| `PLAYBETMAN_BASE_URL` | API host |
| `PLAYBETMAN_LEAGUE_URL` | League page URL used by the tested requests |
| `PLAYBETMAN_TIMEZONE` | Timezone sent to the API |
| `COMPETITION_ID` | Competition identifier |
| `ROUND_ID` | Round identifier used by fetchMatches |
| `MARKET_TYPE` | Market code, e.g. `1X2` |
| `*_INTERVAL_MINUTES` | Polling intervals |

## Raw data

Responses are saved under `data/raw/` as timestamped JSON files. Keep this data private if it contains account-specific or session-related information.

## Important notes

- The live collector is callable but is not scheduled automatically because its request requires period, end_time and round_id values that must be supplied deliberately.
- The collector currently stores raw responses. Database normalization and historical odds analysis are later stages.
- The polling intervals are configurable starting values, not confirmed PlayBetMan rate limits. Respect the service's access rules and avoid excessive requests.
- Do not commit your real `.env`, cookies, tokens or session URLs.
- Use only data and API access you are authorized to use.
