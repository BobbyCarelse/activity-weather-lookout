import "../config/env";
import { resolvers } from "./resolvers";
import { AmbiguousCityError, CityNotFoundError } from "./errors";

interface MockResponses {
  geocoding?: unknown;
  forecastCurrent?: unknown;
  marineCurrent?: unknown;
  forecastDaily?: unknown;
  marineDaily?: unknown;
}

function jsonResponse(body: unknown, ok = true): Response {
  return {
    ok,
    status: ok ? 200 : 500,
    json: async () => body,
  } as Response;
}

function mockOpenMeteo(responses: MockResponses) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    const url = new URL(input.toString());

    if (url.hostname.includes("geocoding")) {
      return jsonResponse(responses.geocoding ?? { results: [] });
    }
    if (url.hostname.includes("marine")) {
      if (url.searchParams.has("daily")) {
        return jsonResponse(responses.marineDaily ?? { daily: { time: [], wave_height_max: [] } });
      }
      return jsonResponse(
        responses.marineCurrent ?? {
          current: { wave_height: null, wave_period: null, swell_wave_height: null },
        },
      );
    }
    if (url.searchParams.has("daily")) {
      return jsonResponse(
        responses.forecastDaily ?? {
          daily: {
            time: [],
            temperature_2m_mean: [],
            rain_sum: [],
            snowfall_sum: [],
            wind_speed_10m_max: [],
          },
        },
      );
    }
    return jsonResponse(
      responses.forecastCurrent ?? {
        current: {
          temperature_2m: 15,
          rain: 0,
          snowfall: 0,
          snow_depth: 0,
          wind_speed_10m: 10,
          weather_code: 0,
          cloud_cover: 20,
        },
      },
    );
  }) as typeof fetch;
}

const singleGeocodingMatch = {
  results: [
    { name: "Chamonix", latitude: 45.9, longitude: 6.87, country: "France", admin1: "Auvergne-Rhône-Alpes" },
  ],
};

describe("Query.activitySuggestions", () => {
  it("returns weather, surf conditions, and suitability for a matched city", async () => {
    mockOpenMeteo({
      geocoding: singleGeocodingMatch,
      forecastCurrent: {
        current: {
          temperature_2m: -10,
          rain: 0,
          snowfall: 2,
          snow_depth: 80,
          wind_speed_10m: 5,
          weather_code: 71,
          cloud_cover: 40,
        },
      },
      marineCurrent: {
        current: { wave_height: null, wave_period: null, swell_wave_height: null },
      },
    });

    const result = await resolvers.Query.activitySuggestions(null, { city: "Chamonix" });

    expect(result.city).toBe("Chamonix");
    expect(result.weather.temperature).toBe(-10);
    expect(result.surfConditions).toBeNull();
    expect(result.suitability).toContainEqual({ activity: "SKIING", suitable: true });
    expect(result.suitability).toContainEqual({ activity: "SURFING", suitable: false });
  });

  it("throws CityNotFoundError when the geocoder returns no matches", async () => {
    mockOpenMeteo({ geocoding: { results: [] } });

    await expect(
      resolvers.Query.activitySuggestions(null, { city: "Nowhereville" }),
    ).rejects.toBeInstanceOf(CityNotFoundError);
  });

  it("throws AmbiguousCityError with the candidate list when the geocoder returns multiple matches", async () => {
    mockOpenMeteo({
      geocoding: {
        results: [
          { name: "Springfield", latitude: 39.8, longitude: -89.6, country: "United States", admin1: "Illinois" },
          { name: "Springfield", latitude: 37.2, longitude: -93.3, country: "United States", admin1: "Missouri" },
        ],
      },
    });

    await expect(
      resolvers.Query.activitySuggestions(null, { city: "Springfield" }),
    ).rejects.toMatchObject({
      extensions: {
        code: "AMBIGUOUS_CITY_MATCH",
        candidates: [
          { name: "Springfield", admin1: "Illinois", country: "United States" },
          { name: "Springfield", admin1: "Missouri", country: "United States" },
        ],
      },
    });
  });
});

describe("Query.weeklyForecast", () => {
  it("returns per-activity daily scores in chronological order, including days with no surf data", async () => {
    mockOpenMeteo({
      geocoding: singleGeocodingMatch,
      forecastDaily: {
        daily: {
          time: ["2026-08-26", "2026-08-27"],
          temperature_2m_mean: [-10, -1],
          rain_sum: [0, 0],
          snowfall_sum: [0, 0],
          wind_speed_10m_max: [5, 5],
        },
      },
      marineDaily: {
        daily: { time: ["2026-08-26", "2026-08-27"], wave_height_max: [null, null] },
      },
    });

    const result = await resolvers.Query.weeklyForecast(null, { city: "Chamonix" });

    expect(result.city).toBe("Chamonix");
    const skiing = result.activities.find((a: { activity: string }) => a.activity === "SKIING")!;
    expect(skiing.days.map((d: { date: string }) => d.date)).toEqual([
      "2026-08-26",
      "2026-08-27",
    ]);
    expect(skiing.days[0].score).toBe(100);

    const surfing = result.activities.find((a: { activity: string }) => a.activity === "SURFING")!;
    expect(surfing.days.every((d: { score: number }) => d.score === 0)).toBe(true);
    expect(surfing.days.every((d: { surf: unknown }) => d.surf === null)).toBe(true);
  });

  it("includes the raw wave height alongside each day's score, for every activity", async () => {
    mockOpenMeteo({
      geocoding: singleGeocodingMatch,
      forecastDaily: {
        daily: {
          time: ["2026-08-26"],
          temperature_2m_mean: [18],
          rain_sum: [0],
          snowfall_sum: [0],
          wind_speed_10m_max: [10],
        },
      },
      marineDaily: {
        daily: { time: ["2026-08-26"], wave_height_max: [1.2] },
      },
    });

    const result = await resolvers.Query.weeklyForecast(null, { city: "Chamonix" });
    const surfing = result.activities.find((a: { activity: string }) => a.activity === "SURFING")!;

    expect(surfing.days[0].surf).toEqual({ date: "2026-08-26", waveHeightMax: 1.2 });
  });
});
