import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4000),
  rateLimitWindowMs: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
  rateLimitMax: Number(process.env.RATE_LIMIT_MAX ?? 10),
  openMeteoForecastBaseUrl: required("OPEN_METEO_FORECAST_BASE_URL"),
  openMeteoGeocodingBaseUrl: required("OPEN_METEO_GEOCODING_BASE_URL"),
  openMeteoMarineBaseUrl: required("OPEN_METEO_MARINE_BASE_URL"),
};
