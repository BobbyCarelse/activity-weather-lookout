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

A city name that matches more than one place (e.g. `\"Springfield\"`) returns a GraphQL error with an `AMBIGUOUS_CITY_MATCH` code and a `candidates` list (name/region/country) — retry with a more specific name. A name that resolves to a city plus something else nearby with the same name (its own airport, a landmark) — e.g. `"Cape Town"` — is *not* treated as ambiguous; see [CONTEXT.md](./CONTEXT.md)'s "Coincident Cluster" entry for why.

## Query fields reference

The full schema is in [src/graphql/schema.ts](./src/graphql/schema.ts) and browsable live via GraphiQL. This section explains what the fields actually mean — the important part isn't the shape, it's the values.

### `city` (both queries)

Free text, resolved to coordinates via Open-Meteo's geocoding. Returns whatever `name` the geocoder resolved to — not necessarily the exact string you passed in.

### `Activity` (both queries)

One of exactly four fixed values: `SKIING`, `SURFING`, `OUTDOOR_SIGHTSEEING`, `INDOOR_SIGHTSEEING`. `INDOOR_SIGHTSEEING` has no weather rules of its own — it's always the complement of `OUTDOOR_SIGHTSEEING` (suitable exactly when Outdoor isn't; its forecast score is always `100 − Outdoor's score`). Full thresholds for all four are in [CONTEXT.md](./CONTEXT.md).

### `activitySuggestions` — current conditions

| Field | Meaning |
|---|---|
| `weather.temperature` | °C, right now |
| `weather.rain` | mm, current rain rate — 0 means dry |
| `weather.snowfall` | cm, currently falling snow |
| `weather.snowDepth` | cm, snow on the ground (Open-Meteo returns this in metres; the API converts it to cm to match `snowfall`'s unit) |
| `weather.windSpeed` | km/h |
| `weather.weatherCode` | Open-Meteo's raw [WMO weather code](https://open-meteo.com/en/docs) — not decoded into text here |
| `weather.cloudCover` | % |
| `surfConditions` | `null` unless the city is near enough to open water for Open-Meteo's Marine API to return meaningful data — `null` effectively means "not a coastal lookup" |
| `surfConditions.waveHeight` | m |
| `surfConditions.wavePeriod` | s, time between wave crests |
| `surfConditions.swellWaveHeight` | m |
| `suitability` | one boolean per `Activity`, evaluated independently — a lookup can return zero, one, or several suitable activities at once |

### `weeklyForecast` — next 7 days, ranked per activity

`activities` has one entry per `Activity`, each with its own 7 `days` in **chronological order** (not sorted by score — sort client-side if you want "best day first").

| Field | Meaning |
|---|---|
| `days[].date` | ISO date, one of the next 7 days |
| `days[].score` | **0–100.** 100 = day sits in that activity's "ideal" band; 0 = day falls outside its "acceptable" band entirely (this activity is a bad idea that day); values in between scale linearly between the two. See CONTEXT.md's Ideal/Acceptable bands for the exact numbers per activity. |
| `days[].weather` | that day's aggregated forecast: `temperatureMean` (°C), `rainSum` (mm total for the day), `snowfallSum` (cm total for the day), `windSpeedMax` (km/h) |
| `days[].surf` | `null` unless the city is near open water — same meaning as `surfConditions` above, but for that specific day; only relevant for the `SURFING` activity's score, though it's attached to every activity's days for consistency |

A `score` of 0 doesn't mean "no data" — check `weather`/`surf` for why (e.g. `SKIING` scores 0 on any day with active rain, regardless of temperature; `SURFING` scores 0 on every day when `surf` is `null`, since there's nothing to score).

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
