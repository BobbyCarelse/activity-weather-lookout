import { Activity, SurfConditions, WeatherSnapshot } from "../weather/types";
import { NO_RAIN_THRESHOLD_MM } from "./constants";

export function isSkiingSuitable(weather: WeatherSnapshot): boolean {
  return (
    weather.temperature >= -20 &&
    weather.temperature <= 2 &&
    weather.snowDepth >= 50 &&
    weather.rain < NO_RAIN_THRESHOLD_MM
  );
}

export function isSurfingSuitable(
  weather: WeatherSnapshot,
  surf: SurfConditions | null,
): boolean {
  if (!surf) return false;
  return (
    surf.waveHeight >= 0.6 && surf.waveHeight <= 2.5 && weather.windSpeed < 30
  );
}

export function isOutdoorSightseeingSuitable(weather: WeatherSnapshot): boolean {
  return (
    weather.temperature >= 10 &&
    weather.temperature <= 24 &&
    weather.rain < 2.5 &&
    weather.windSpeed < 30
  );
}

export function isIndoorSightseeingSuitable(weather: WeatherSnapshot): boolean {
  return !isOutdoorSightseeingSuitable(weather);
}

export interface ActivitySuitabilityResult {
  activity: Activity;
  suitable: boolean;
}

export function evaluateSuitability(
  weather: WeatherSnapshot,
  surf: SurfConditions | null,
): ActivitySuitabilityResult[] {
  return [
    { activity: "SKIING", suitable: isSkiingSuitable(weather) },
    { activity: "SURFING", suitable: isSurfingSuitable(weather, surf) },
    {
      activity: "OUTDOOR_SIGHTSEEING",
      suitable: isOutdoorSightseeingSuitable(weather),
    },
    {
      activity: "INDOOR_SIGHTSEEING",
      suitable: isIndoorSightseeingSuitable(weather),
    },
  ];
}
