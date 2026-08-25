# Activity Weather Lookout

A GraphQL API that, given a city name, looks up its current weather and reports which of a fixed set of Activities are currently suitable.

## Language

**Activity**:
One of exactly four fixed categories the API can recommend: Skiing, Surfing, Outdoor Sightseeing, Indoor Sightseeing. Not user-extensible.

**Weather Snapshot**:
The current (not forecast, not historical) atmospheric conditions for a City — temperature (°C), precipitation, snowfall (cm), snow depth (cm), wind speed (km/h), weather code, cloud cover — fetched from Open-Meteo's Forecast API at request time. Snow depth is normalized to cm at the fetch boundary since Open-Meteo's own API returns it in metres while every other snow-related figure here (snowfall, and the Suitability threshold) is in cm — a real bug once, worth stating explicitly so it isn't reintroduced.
_Avoid_: Forecast (implies future conditions; this app only ever reads "right now")

**Surf Conditions**:
Wave and swell data for a City — wave height, wave period, swell height — fetched separately from Open-Meteo's Marine Weather API. Distinct from Weather Snapshot because it comes from a different Open-Meteo product and is only meaningful near coastal/ocean coordinates. When the Marine API has no meaningful nearby data for a City, Surf Conditions is absent and Surfing is treated as not suitable rather than trusting a distant grid-cell's numbers.

**Suitability**:
Whether a given Activity's required weather conditions are currently met. Computed inside this app from researched per-Activity thresholds — Open-Meteo only supplies raw weather data, never suggests activities itself. Each Activity is evaluated independently, so a single City lookup can report zero, one, or several suitable Activities. Indoor Sightseeing is the one exception: it has no weather thresholds of its own — its Suitability is the logical inverse of Outdoor Sightseeing's, guaranteeing exactly one of the two sightseeing Activities is always suitable.

Thresholds (`rain` means liquid precipitation only, distinct from Open-Meteo's combined `precipitation` field, so falling snow never misreads as disqualifying rain):
- **Skiing**: `temperature_2m` −20°C to 2°C, `snow_depth` ≥ 50cm, `rain` ≈ 0 (any active rain disqualifies regardless of snow depth — rain-on-snow ruins the base).
- **Surfing**: `wave_height` 0.6m–2.5m AND `wind_speed_10m` < 30km/h (both gates must pass independently — good wave size with high wind still fails).
- **Outdoor Sightseeing**: `temperature_2m` 10°C–24°C, `rain` < 2.5mm/h (drizzle tolerated; only sustained rain disqualifies), `wind_speed_10m` < 30km/h. `cloud_cover` is not part of the pass/fail logic.
- **Indoor Sightseeing**: exact inverse of Outdoor Sightseeing's three conditions above.

**Activity Suggestions**:
The full result of a City lookup: the Weather Snapshot, the Surf Conditions (when available), and each Activity's Suitability verdict, returned together. The raw numbers are included alongside the verdicts so the caller can judge the underlying conditions themselves rather than trusting a bare boolean. Answers "is this Activity good *right now*" — distinct from Weekly Forecast, which looks ahead.
_Avoid_: Forecast, weekly (this is the real-time feature; see Weekly Forecast for the forward-looking one)

**Forecast Day**:
One of the next 7 days' aggregated weather, sourced from Open-Meteo's `daily=` forecast (and, for Surfing, its Marine API `daily=` equivalent) rather than the instantaneous `current=` reading behind Weather Snapshot. Aggregated means daily min/max/sum values (e.g. `temperature_2m_max`), not a single point-in-time reading.

**Suitability Score**:
A 0–100 rating of how good a single Forecast Day looks for a given Activity, based on how close that day's conditions sit to the Activity's Ideal Range versus its Acceptable Range. Distinct from Suitability (which is a same-day boolean, not a graded score) — Suitability Score exists specifically to make the 7 Forecast Days rankable against each other.

**Ideal Range / Acceptable Range**:
For each threshold variable in an Activity's Suitability rules (e.g. Skiing's temperature), the Acceptable Range is the existing pass/fail boundary already defined for Suitability. The Ideal Range is a narrower band inside it representing the best conditions, used only by Suitability Score — a Forecast Day inside the Ideal Range scores 100; one outside the Acceptable Range scores 0 (a hard floor — crossing the Acceptable boundary is disqualifying exactly as it already is for Suitability); a Forecast Day between the two bands is scored on a linear scale between them. When an Activity has multiple threshold variables (e.g. Surfing's wave height and wind), the day's score is the **minimum** of the per-variable scores — one bad variable caps the day, mirroring how every Suitability gate must already pass for the boolean case.

Bands (Ideal → Acceptable):
- Skiing temperature: −15°C to −5°C → −20°C to 2°C
- Surfing wave_height: 0.6m–2m → 0.6m–2.5m
- Surfing wind_speed: < 15km/h → < 30km/h
- Outdoor Sightseeing temperature: 15°C–24°C → 10°C–24°C
- Outdoor Sightseeing rain: 0mm/h → < 2.5mm/h
- Outdoor Sightseeing wind_speed: < 20km/h → < 30km/h
- Indoor Sightseeing: no bands of its own — its score is always `100 − Outdoor Sightseeing's score`.

Skiing's forecast score is the minimum of its temperature and rain-disqualifier sub-scores only (no snow-depth variable, since Open-Meteo's daily forecast doesn't expose it) — `snowfall_sum` is a separate additive bonus on top, not a gated variable in the minimum.

**Weekly Forecast**:
The per-Activity ranking result: for each of the 4 Activities, its Suitability Score across each of the next 7 Forecast Days. Rankings are computed independently per Activity — there is no cross-Activity "best thing to do this week" comparison, since scores across different Activities aren't computed on a comparable basis.

**City Lookup**:
Resolving a user-typed city name string to coordinates via Open-Meteo's Geocoding API, ahead of fetching its Weather Snapshot (and, for Surfing, its Surf Conditions).

**Ambiguous Match**:
The outcome when City Lookup's geocoder returns more than one candidate for a typed name AND those candidates are not a Coincident Cluster (see below). The API surfaces this as an error requiring the caller to disambiguate, rather than silently picking a top result — there is no frontend autocomplete in this project to resolve ambiguity before the request is made. The error includes the candidate list (name, region, country) so the caller knows what to narrow down.
_Avoid_: treating every multi-candidate result as ambiguous — a Coincident Cluster isn't.

**Coincident Cluster**:
Multiple City Lookup candidates for one typed name that all describe the same real-world place (e.g. "Cape Town" matching both the city and its international airport) rather than genuinely different places sharing a name (e.g. "Springfield", or "Nazaré" recurring across several unrelated Brazilian states). City Lookup determines this in two passes:
1. **Populated-place filter**: candidates whose Open-Meteo `feature_code` isn't a populated-place type (`PPL*`) — airports, capes, mountains, landmarks — are discarded first. They aren't places with weather worth distinguishing from the city they're named after or near (real example: searching "Cape Town" returned the city, its international airport 17km away, and — via pure name coincidence — "Cape Townshend," an unrelated headland in Australia; only the first is a populated place). If this leaves exactly one candidate, City Lookup resolves to it directly. If it leaves none, City Lookup reports the same outcome as no match at all.
2. **Proximity**: of the remaining populated-place candidates, if every pair is within 25km of each other, they're a Coincident Cluster and City Lookup resolves to the most populous one (ties, or missing population data, fall back to whichever candidate the geocoder listed first). If any pair exceeds 25km, they're not a cluster — this is a genuine Ambiguous Match.

Country or even admin1 (region/state) matching alone was considered and rejected as the detection method — a single large region can itself contain two unrelated places sharing a name, so it doesn't actually test what proximity tests directly.
