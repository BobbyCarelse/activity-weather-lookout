import {
  Activity,
  ForecastDaySurf,
  ForecastDayWeather,
} from "../weather/types";
import { NO_RAIN_THRESHOLD_MM } from "./constants";

type Band = { ideal: [number, number]; acceptable: [number, number] };

/**
 * Scores `value` against a two-band model: 100 inside `ideal`, 0 outside
 * `acceptable`, linearly interpolated in between. Ideal and acceptable may
 * share an edge (e.g. a shared floor of 0 for a "lower is better" metric
 * like wind speed) — that edge then never contributes a gradient, since the
 * "outside acceptable" check already handles it.
 */
export function scoreBand(
  value: number,
  ideal: [number, number],
  acceptable: [number, number],
): number {
  const [idealMin, idealMax] = ideal;
  const [acceptableMin, acceptableMax] = acceptable;

  if (value >= idealMin && value <= idealMax) return 100;
  if (value < acceptableMin || value > acceptableMax) return 0;

  if (value < idealMin) {
    return ((value - acceptableMin) / (idealMin - acceptableMin)) * 100;
  }
  return ((acceptableMax - value) / (acceptableMax - idealMax)) * 100;
}

const SKIING_TEMPERATURE: Band = { ideal: [-15, -5], acceptable: [-20, 2] };
const SURFING_WAVE_HEIGHT: Band = { ideal: [0.6, 2], acceptable: [0.6, 2.5] };
const SURFING_WIND_SPEED: Band = { ideal: [0, 15], acceptable: [0, 30] };
const OUTDOOR_TEMPERATURE: Band = { ideal: [15, 24], acceptable: [10, 24] };
const OUTDOOR_RAIN: Band = { ideal: [0, 0], acceptable: [0, 2.5] };
const OUTDOOR_WIND_SPEED: Band = { ideal: [0, 20], acceptable: [0, 30] };

// Fresh snowfall is a bonus on top of Skiing's temperature/rain score, not a
// gated variable — the daily forecast has no snow_depth, so we can't know
// the base is adequate, only that conditions look favorable for it.
const SKIING_SNOWFALL_BONUS_MAX = 10;
const SKIING_SNOWFALL_BONUS_FULL_AT_CM = 5;

function skiingScore(day: ForecastDayWeather): number {
  const temperatureScore = scoreBand(
    day.temperatureMean,
    SKIING_TEMPERATURE.ideal,
    SKIING_TEMPERATURE.acceptable,
  );
  const rainScore = day.rainSum < NO_RAIN_THRESHOLD_MM ? 100 : 0;
  const baseScore = Math.min(temperatureScore, rainScore);

  const snowfallBonus =
    Math.min(day.snowfallSum, SKIING_SNOWFALL_BONUS_FULL_AT_CM) /
    SKIING_SNOWFALL_BONUS_FULL_AT_CM *
    SKIING_SNOWFALL_BONUS_MAX;

  return Math.min(baseScore + snowfallBonus, 100);
}

function surfingScore(
  day: ForecastDayWeather,
  surf: ForecastDaySurf | null,
): number {
  if (!surf) return 0;
  const waveScore = scoreBand(
    surf.waveHeightMax,
    SURFING_WAVE_HEIGHT.ideal,
    SURFING_WAVE_HEIGHT.acceptable,
  );
  const windScore = scoreBand(
    day.windSpeedMax,
    SURFING_WIND_SPEED.ideal,
    SURFING_WIND_SPEED.acceptable,
  );
  return Math.min(waveScore, windScore);
}

function outdoorSightseeingScore(day: ForecastDayWeather): number {
  const temperatureScore = scoreBand(
    day.temperatureMean,
    OUTDOOR_TEMPERATURE.ideal,
    OUTDOOR_TEMPERATURE.acceptable,
  );
  const rainScore = scoreBand(
    day.rainSum,
    OUTDOOR_RAIN.ideal,
    OUTDOOR_RAIN.acceptable,
  );
  const windScore = scoreBand(
    day.windSpeedMax,
    OUTDOOR_WIND_SPEED.ideal,
    OUTDOOR_WIND_SPEED.acceptable,
  );
  return Math.min(temperatureScore, rainScore, windScore);
}

export interface DailyActivityScore {
  date: string;
  score: number;
  raw: ForecastDayWeather;
}

export type WeeklyScores = Record<Activity, DailyActivityScore[]>;

export function evaluateWeeklyScores(
  days: ForecastDayWeather[],
  surfDays: (ForecastDaySurf | null)[],
): WeeklyScores {
  const result: WeeklyScores = {
    SKIING: [],
    SURFING: [],
    OUTDOOR_SIGHTSEEING: [],
    INDOOR_SIGHTSEEING: [],
  };

  days.forEach((day, index) => {
    const surf = surfDays[index] ?? null;
    const outdoorScore = outdoorSightseeingScore(day);

    result.SKIING.push({ date: day.date, score: skiingScore(day), raw: day });
    result.SURFING.push({
      date: day.date,
      score: surfingScore(day, surf),
      raw: day,
    });
    result.OUTDOOR_SIGHTSEEING.push({
      date: day.date,
      score: outdoorScore,
      raw: day,
    });
    result.INDOOR_SIGHTSEEING.push({
      date: day.date,
      score: 100 - outdoorScore,
      raw: day,
    });
  });

  return result;
}
