import { env } from "../config/env";
import { withTtlCache } from "./cache";
import {
  Coordinates,
  ForecastDaySurf,
  ForecastDayWeather,
  GeocodingMatch,
  SurfConditions,
  WeatherSnapshot,
} from "./types";

// TTLs per CONTEXT.md's Cache Policy — reflecting how fast each data type
// actually goes stale, not one blanket number.
const GEOCODING_TTL_MS = 24 * 60 * 60 * 1000;
const CURRENT_CONDITIONS_TTL_MS = 60 * 60 * 1000;
const WEEKLY_FORECAST_TTL_MS = 3 * 60 * 60 * 1000;

const coordinatesKey = ({ latitude, longitude }: Coordinates): string =>
  `${latitude},${longitude}`;

interface GeocodingResponse {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
    feature_code: string;
    population?: number;
  }>;
}

async function geocodeCityUncached(city: string): Promise<GeocodingMatch[]> {
  const url = new URL(env.openMeteoGeocodingBaseUrl);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "10");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo geocoding request failed: ${response.status}`);
  }
  const body = (await response.json()) as GeocodingResponse;

  return (body.results ?? []).map((result) => ({
    name: result.name,
    latitude: result.latitude,
    longitude: result.longitude,
    country: result.country ?? null,
    admin1: result.admin1 ?? null,
    featureCode: result.feature_code,
    population: result.population ?? null,
  }));
}

export const geocodeCity = withTtlCache(
  geocodeCityUncached,
  GEOCODING_TTL_MS,
  (city) => city.trim().toLowerCase(),
);

interface CurrentWeatherResponse {
  current: {
    temperature_2m: number;
    rain: number;
    snowfall: number;
    snow_depth: number;
    wind_speed_10m: number;
    weather_code: number;
    cloud_cover: number;
  };
}

async function fetchCurrentWeatherUncached({
  latitude,
  longitude,
}: Coordinates): Promise<WeatherSnapshot> {
  const url = new URL(env.openMeteoForecastBaseUrl);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,rain,snowfall,snow_depth,wind_speed_10m,weather_code,cloud_cover",
  );

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast request failed: ${response.status}`);
  }
  const body = (await response.json()) as CurrentWeatherResponse;

  return {
    temperature: body.current.temperature_2m,
    rain: body.current.rain,
    snowfall: body.current.snowfall,
    // Open-Meteo returns snow_depth in metres; CONTEXT.md's Skiing
    // threshold (and WeatherSnapshot.snowDepth generally) is in cm, matching
    // snowfall's own unit — convert at the boundary so nothing downstream
    // has to know Open-Meteo's raw unit.
    snowDepth: body.current.snow_depth * 100,
    windSpeed: body.current.wind_speed_10m,
    weatherCode: body.current.weather_code,
    cloudCover: body.current.cloud_cover,
  };
}

export const fetchCurrentWeather = withTtlCache(
  fetchCurrentWeatherUncached,
  CURRENT_CONDITIONS_TTL_MS,
  coordinatesKey,
);

interface CurrentMarineResponse {
  current: {
    wave_height: number | null;
    wave_period: number | null;
    swell_wave_height: number | null;
  };
}

async function fetchCurrentSurfConditionsUncached({
  latitude,
  longitude,
}: Coordinates): Promise<SurfConditions | null> {
  const url = new URL(env.openMeteoMarineBaseUrl);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("current", "wave_height,wave_period,swell_wave_height");

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    // Network-level failure calling the Marine API is treated the same as
    // "no meaningful data for this location" per CONTEXT.md's Surf
    // Conditions definition — Surfing simply falls back to not suitable.
    return null;
  }
  if (!response.ok) return null;

  const body = (await response.json()) as CurrentMarineResponse;
  const { wave_height, wave_period, swell_wave_height } = body.current;

  if (wave_height === null || wave_period === null || swell_wave_height === null) {
    return null;
  }

  return {
    waveHeight: wave_height,
    wavePeriod: wave_period,
    swellWaveHeight: swell_wave_height,
  };
}

export const fetchCurrentSurfConditions = withTtlCache(
  fetchCurrentSurfConditionsUncached,
  CURRENT_CONDITIONS_TTL_MS,
  coordinatesKey,
);

interface DailyWeatherResponse {
  daily: {
    time: string[];
    temperature_2m_mean: number[];
    rain_sum: number[];
    snowfall_sum: number[];
    wind_speed_10m_max: number[];
  };
}

async function fetchWeeklyWeatherForecastUncached({
  latitude,
  longitude,
}: Coordinates): Promise<ForecastDayWeather[]> {
  const url = new URL(env.openMeteoForecastBaseUrl);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "daily",
    "temperature_2m_mean,rain_sum,snowfall_sum,wind_speed_10m_max",
  );
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "auto");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Open-Meteo forecast request failed: ${response.status}`);
  }
  const body = (await response.json()) as DailyWeatherResponse;

  return body.daily.time.map((date, index) => ({
    date,
    temperatureMean: body.daily.temperature_2m_mean[index],
    rainSum: body.daily.rain_sum[index],
    snowfallSum: body.daily.snowfall_sum[index],
    windSpeedMax: body.daily.wind_speed_10m_max[index],
  }));
}

export const fetchWeeklyWeatherForecast = withTtlCache(
  fetchWeeklyWeatherForecastUncached,
  WEEKLY_FORECAST_TTL_MS,
  coordinatesKey,
);

interface DailyMarineResponse {
  daily: {
    time: string[];
    wave_height_max: Array<number | null>;
  };
}

async function fetchWeeklySurfForecastUncached({
  latitude,
  longitude,
}: Coordinates): Promise<Array<ForecastDaySurf | null>> {
  const url = new URL(env.openMeteoMarineBaseUrl);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set("daily", "wave_height_max");
  url.searchParams.set("forecast_days", "7");
  url.searchParams.set("timezone", "auto");

  const noDataForWeek = (): Array<ForecastDaySurf | null> => Array(7).fill(null);

  let response: Response;
  try {
    response = await fetch(url);
  } catch {
    return noDataForWeek();
  }
  if (!response.ok) return noDataForWeek();

  const body = (await response.json()) as DailyMarineResponse;

  return body.daily.time.map((date, index) => {
    const waveHeightMax = body.daily.wave_height_max[index];
    if (waveHeightMax === null || waveHeightMax === undefined) return null;
    return { date, waveHeightMax };
  });
}

export const fetchWeeklySurfForecast = withTtlCache(
  fetchWeeklySurfForecastUncached,
  WEEKLY_FORECAST_TTL_MS,
  coordinatesKey,
);
