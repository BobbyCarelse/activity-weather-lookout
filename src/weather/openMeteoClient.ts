import { env } from "../config/env";
import {
  Coordinates,
  ForecastDaySurf,
  ForecastDayWeather,
  GeocodingMatch,
  SurfConditions,
  WeatherSnapshot,
} from "./types";

interface GeocodingResponse {
  results?: Array<{
    name: string;
    latitude: number;
    longitude: number;
    country?: string;
    admin1?: string;
  }>;
}

export async function geocodeCity(city: string): Promise<GeocodingMatch[]> {
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
  }));
}

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

export async function fetchCurrentWeather({
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
    snowDepth: body.current.snow_depth,
    windSpeed: body.current.wind_speed_10m,
    weatherCode: body.current.weather_code,
    cloudCover: body.current.cloud_cover,
  };
}

interface CurrentMarineResponse {
  current: {
    wave_height: number | null;
    wave_period: number | null;
    swell_wave_height: number | null;
  };
}

export async function fetchCurrentSurfConditions({
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

interface DailyWeatherResponse {
  daily: {
    time: string[];
    temperature_2m_mean: number[];
    rain_sum: number[];
    snowfall_sum: number[];
    wind_speed_10m_max: number[];
  };
}

export async function fetchWeeklyWeatherForecast({
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

interface DailyMarineResponse {
  daily: {
    time: string[];
    wave_height_max: Array<number | null>;
  };
}

export async function fetchWeeklySurfForecast({
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
