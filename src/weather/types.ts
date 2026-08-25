export type Activity =
  | "SKIING"
  | "SURFING"
  | "OUTDOOR_SIGHTSEEING"
  | "INDOOR_SIGHTSEEING";

export const ACTIVITIES: Activity[] = [
  "SKIING",
  "SURFING",
  "OUTDOOR_SIGHTSEEING",
  "INDOOR_SIGHTSEEING",
];

export interface GeocodingMatch {
  name: string;
  latitude: number;
  longitude: number;
  country: string | null;
  admin1: string | null;
}

export interface WeatherSnapshot {
  temperature: number;
  rain: number;
  snowfall: number;
  snowDepth: number;
  windSpeed: number;
  weatherCode: number;
  cloudCover: number;
}

export interface SurfConditions {
  waveHeight: number;
  wavePeriod: number;
  swellWaveHeight: number;
}

export interface ForecastDayWeather {
  date: string;
  temperatureMean: number;
  rainSum: number;
  snowfallSum: number;
  windSpeedMax: number;
}

export interface ForecastDaySurf {
  date: string;
  waveHeightMax: number;
}
