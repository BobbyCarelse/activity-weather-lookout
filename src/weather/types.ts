export type Activity =
  | "SKIING"
  | "SURFING"
  | "OUTDOOR_SIGHTSEEING"
  | "INDOOR_SIGHTSEEING";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface GeocodingMatch extends Coordinates {
  name: string;
  country: string | null;
  admin1: string | null;
  featureCode: string;
  population: number | null;
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
