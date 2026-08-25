import { evaluateSuitability } from "../activities/suitability";
import { evaluateWeeklyScores } from "../activities/scoring";
import { resolveCityCandidates } from "../weather/cityResolution";
import {
  fetchCurrentSurfConditions,
  fetchCurrentWeather,
  fetchWeeklySurfForecast,
  fetchWeeklyWeatherForecast,
  geocodeCity,
} from "../weather/openMeteoClient";
import { GeocodingMatch } from "../weather/types";
import { AmbiguousCityError, CityNotFoundError } from "./errors";

async function resolveCity(city: string): Promise<GeocodingMatch> {
  const matches = await geocodeCity(city);
  const resolution = resolveCityCandidates(matches);

  if (resolution.status === "not_found") throw new CityNotFoundError(city);
  if (resolution.status === "ambiguous") {
    throw new AmbiguousCityError(city, resolution.candidates);
  }
  return resolution.match;
}

export const resolvers = {
  Query: {
    activitySuggestions: async (_parent: unknown, args: { city: string }) => {
      const match = await resolveCity(args.city);

      const [weather, surfConditions] = await Promise.all([
        fetchCurrentWeather(match),
        fetchCurrentSurfConditions(match),
      ]);

      return {
        city: match.name,
        weather,
        surfConditions,
        suitability: evaluateSuitability(weather, surfConditions),
      };
    },

    weeklyForecast: async (_parent: unknown, args: { city: string }) => {
      const match = await resolveCity(args.city);

      // Both calls request the same coordinates and the same 7-day window,
      // so the two daily series line up positionally by index.
      const [days, surfDays] = await Promise.all([
        fetchWeeklyWeatherForecast(match),
        fetchWeeklySurfForecast(match),
      ]);

      const scores = evaluateWeeklyScores(days, surfDays);

      return {
        city: match.name,
        activities: (Object.keys(scores) as Array<keyof typeof scores>).map(
          (activity) => ({
            activity,
            days: scores[activity].map((day, index) => ({
              date: day.date,
              score: day.score,
              weather: day.raw,
              surf: surfDays[index] ?? null,
            })),
          }),
        ),
      };
    },
  },
};
