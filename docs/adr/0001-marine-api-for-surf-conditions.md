# Use Open-Meteo Marine Weather API for Surf Conditions

Surfing suitability needs real wave/swell data, not just wind speed. Open-Meteo's core Forecast API doesn't provide waves — that lives in a separate product, the Marine Weather API, which resolves a nearest data grid-cell for any lat/lon (including inland ones) rather than erroring outright.

We chose to call the Marine Weather API directly for real wave-height/period/swell data, rather than approximating surf suitability from forecast wind speed alone. This adds a second external Open-Meteo dependency and means inland cities will get marine data that isn't physically meaningful (no ocean nearby) — Suitability logic for Surfing must treat that case as "not suitable" rather than trusting whatever the grid-cell returns.

Considered alternative: wind-speed-only proxy, avoiding the second dependency but producing much weaker surf suggestions.
