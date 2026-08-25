# Activity Weather Lookout

A GraphQL API that, given a city name, suggests which of four activities — Skiing, Surfing, Outdoor Sightseeing, Indoor Sightseeing — suit the weather. Two queries: one for current conditions, one ranking the next 7 days per activity. Weather comes from [Open-Meteo](https://open-meteo.com/) (forecast, geocoding, and marine APIs — all free, no API key required).

See [CONTEXT.md](./CONTEXT.md) for the domain model (terms, thresholds, scoring rules) and [docs/adr/](./docs/adr/) for architectural decisions.

## Prerequisites

- Node.js ≥ 22 (see `.nvmrc`)

## Setup

```bash
npm install
cp .env.example .env
```

The default `.env.example` values work out of the box — Open-Meteo's free tier needs no API key, so nothing in `.env` has to be filled in to get started. See [Configuration](#configuration) below if you want to change the port or rate limit.

## Running the server

```bash
npm run dev     # tsx watch — restarts on file changes, for local development
```

or build and run the compiled output:

```bash
npm run build
npm start
```

Either way the server listens on `http://localhost:4000` by default (`PORT` in `.env`), with a single GraphQL endpoint at `/graphql`.

## Testing the GraphQL API

### Interactive: Yoga's GraphiQL

With the server running, open [http://localhost:4000/graphql](http://localhost:4000/graphql) in a browser. `graphql-yoga` serves an interactive GraphiQL explorer there — browse the schema, autocomplete fields, and run queries directly.

### From the command line

**Current conditions** (`activitySuggestions`):

```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ activitySuggestions(city: \"Chamonix\") { city weather { temperature windSpeed rain } surfConditions { waveHeight } suitability { activity suitable } } }"}'
```

**7-day forecast, ranked per activity** (`weeklyForecast`):

```bash
curl -s -X POST http://localhost:4000/graphql \
  -H "Content-Type: application/json" \
  -d '{"query":"{ weeklyForecast(city: \"Chamonix\") { city activities { activity days { date score } } } }"}'
```

A city name that matches more than one place (e.g. `\"Springfield\"`) returns a GraphQL error with an `AMBIGUOUS_CITY_MATCH` code and a `candidates` list (name/region/country) — retry with a more specific name.

### Automated tests

```bash
npm test         # full Jest suite: pure domain-logic tests, resolver tests
                  # (Open-Meteo calls mocked), and a rate-limiter test
npm run typecheck # tsc --noEmit
```

## Configuration

All variables live in `.env` (see `.env.example` for the full list with defaults):

| Variable | Purpose |
|---|---|
| `PORT` | Server port |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Per-IP rate limit on the GraphQL endpoint (default: 10 requests / 60s) — exceeding it returns HTTP 429 |
| `OPEN_METEO_FORECAST_BASE_URL` | Open-Meteo forecast API (current + daily weather) |
| `OPEN_METEO_GEOCODING_BASE_URL` | Open-Meteo geocoding API (city name → coordinates) |
| `OPEN_METEO_MARINE_BASE_URL` | Open-Meteo marine API (wave data, for Surfing) |
