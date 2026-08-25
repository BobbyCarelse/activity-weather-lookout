# Hand-rolled in-memory TTL cache, wrapping typed client functions, not the HTTP layer

Repeat lookups for the same city were re-fetching from Open-Meteo every time, even though geocoding results are effectively permanent and current-conditions data is only meaningful for about an hour anyway. The goal is latency for repeat lookups, not avoiding Open-Meteo's rate limits — its free tier allows 600 requests/min, and our own per-IP limiter already caps any client to 10 requests/min, so exhausting Open-Meteo's limit isn't a realistic risk.

We checked whether Open-Meteo sends `Cache-Control`/`ETag`/`Expires` headers we could just honor via a standard HTTP-caching layer — it sends none, on any of the three APIs. That ruled out "cache policy on the HTTP client" as a way to avoid inventing our own TTLs: since we have to assign a TTL either way, and different endpoints need different TTLs (city lookups barely change; current weather changes constantly), the cache is wired around the five existing typed functions in `openMeteoClient.ts` (`geocodeCity`, `fetchCurrentWeather`, `fetchCurrentSurfConditions`, `fetchWeeklyWeatherForecast`, `fetchWeeklySurfForecast`) rather than around request URLs. Each function already knows what kind of data it's fetching; a URL-pattern-matching cache would have to rediscover that from the request shape.

This is a cache, not durable storage — nothing needs to survive a process restart or outlive its TTL, so we didn't reach for a database. See CONTEXT.md's Cache Policy entry for the actual TTL numbers.

## Considered options

- **HTTP-client-level cache** (URL-keyed, e.g. respecting/assigning `Cache-Control`): rejected — no origin headers to honor, and per-endpoint TTLs would need URL pattern-matching to reconstruct a distinction the typed functions already make for free.
- **`lru-cache` (npm)**: rejected for now in favor of hand-rolling a small `Map`-based TTL cache. `lru-cache` would add max-entry-count eviction for free, which we don't currently need — the existing 10 req/min-per-IP rate limiter already bounds how fast distinct cities can be queried, so unbounded memory growth isn't a realistic near-term risk. Worth revisiting if that assumption changes (e.g. the rate limiter is removed or loosened, or usage patterns show otherwise).
- **External store (Redis)**: rejected — no deployment infrastructure exists yet for this project, and a cache that resets on restart is entirely acceptable given the TTLs involved.
