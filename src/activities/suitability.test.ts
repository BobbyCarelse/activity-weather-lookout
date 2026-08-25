import {
  isSkiingSuitable,
  isSurfingSuitable,
  isOutdoorSightseeingSuitable,
  isIndoorSightseeingSuitable,
  evaluateSuitability,
} from "./suitability";
import { SurfConditions, WeatherSnapshot } from "../weather/types";

function weather(overrides: Partial<WeatherSnapshot> = {}): WeatherSnapshot {
  return {
    temperature: 15,
    rain: 0,
    snowfall: 0,
    snowDepth: 0,
    windSpeed: 10,
    weatherCode: 0,
    cloudCover: 20,
    ...overrides,
  };
}

function surf(overrides: Partial<SurfConditions> = {}): SurfConditions {
  return {
    waveHeight: 1.2,
    wavePeriod: 10,
    swellWaveHeight: 1,
    ...overrides,
  };
}

describe("isSkiingSuitable", () => {
  it("is suitable when cold, deep base, and dry", () => {
    expect(
      isSkiingSuitable(weather({ temperature: -10, snowDepth: 80, rain: 0 })),
    ).toBe(true);
  });

  it("is not suitable when too warm", () => {
    expect(
      isSkiingSuitable(weather({ temperature: 5, snowDepth: 80, rain: 0 })),
    ).toBe(false);
  });

  it("is not suitable when too cold", () => {
    expect(
      isSkiingSuitable(weather({ temperature: -25, snowDepth: 80, rain: 0 })),
    ).toBe(false);
  });

  it("is not suitable when snow base is too thin", () => {
    expect(
      isSkiingSuitable(weather({ temperature: -10, snowDepth: 20, rain: 0 })),
    ).toBe(false);
  });

  it("is not suitable when actively raining, even with a deep base", () => {
    expect(
      isSkiingSuitable(weather({ temperature: -10, snowDepth: 80, rain: 3 })),
    ).toBe(false);
  });
});

describe("isSurfingSuitable", () => {
  it("is suitable with good wave height and calm wind", () => {
    expect(
      isSurfingSuitable(weather({ windSpeed: 10 }), surf({ waveHeight: 1.2 })),
    ).toBe(true);
  });

  it("is not suitable when there is no Surf Conditions data (e.g. inland city)", () => {
    expect(isSurfingSuitable(weather({ windSpeed: 10 }), null)).toBe(false);
  });

  it("is not suitable when waves are too flat", () => {
    expect(
      isSurfingSuitable(weather({ windSpeed: 10 }), surf({ waveHeight: 0.3 })),
    ).toBe(false);
  });

  it("is not suitable when waves are too big", () => {
    expect(
      isSurfingSuitable(weather({ windSpeed: 10 }), surf({ waveHeight: 3.5 })),
    ).toBe(false);
  });

  it("is not suitable when wind is too strong, even with good wave height", () => {
    expect(
      isSurfingSuitable(weather({ windSpeed: 40 }), surf({ waveHeight: 1.5 })),
    ).toBe(false);
  });
});

describe("isOutdoorSightseeingSuitable", () => {
  it("is suitable when mild, dry, and calm", () => {
    expect(
      isOutdoorSightseeingSuitable(
        weather({ temperature: 18, rain: 0, windSpeed: 10 }),
      ),
    ).toBe(true);
  });

  it("tolerates light drizzle", () => {
    expect(
      isOutdoorSightseeingSuitable(
        weather({ temperature: 18, rain: 1, windSpeed: 10 }),
      ),
    ).toBe(true);
  });

  it("is not suitable during sustained rain", () => {
    expect(
      isOutdoorSightseeingSuitable(
        weather({ temperature: 18, rain: 4, windSpeed: 10 }),
      ),
    ).toBe(false);
  });

  it("is not suitable when too cold", () => {
    expect(
      isOutdoorSightseeingSuitable(
        weather({ temperature: 5, rain: 0, windSpeed: 10 }),
      ),
    ).toBe(false);
  });

  it("is not suitable when too hot", () => {
    expect(
      isOutdoorSightseeingSuitable(
        weather({ temperature: 30, rain: 0, windSpeed: 10 }),
      ),
    ).toBe(false);
  });

  it("is not suitable when too windy", () => {
    expect(
      isOutdoorSightseeingSuitable(
        weather({ temperature: 18, rain: 0, windSpeed: 40 }),
      ),
    ).toBe(false);
  });
});

describe("isIndoorSightseeingSuitable", () => {
  it("is the exact inverse of Outdoor Sightseeing suitability", () => {
    const goodOutdoorWeather = weather({ temperature: 18, rain: 0, windSpeed: 10 });
    const badOutdoorWeather = weather({ temperature: 30, rain: 5, windSpeed: 40 });

    expect(isIndoorSightseeingSuitable(goodOutdoorWeather)).toBe(false);
    expect(isIndoorSightseeingSuitable(badOutdoorWeather)).toBe(true);
  });
});

describe("evaluateSuitability", () => {
  it("returns a verdict for all four activities, independently evaluated", () => {
    const result = evaluateSuitability(
      weather({ temperature: -10, snowDepth: 80, rain: 0, windSpeed: 5 }),
      null,
    );

    expect(result).toEqual([
      { activity: "SKIING", suitable: true },
      { activity: "SURFING", suitable: false },
      { activity: "OUTDOOR_SIGHTSEEING", suitable: false },
      { activity: "INDOOR_SIGHTSEEING", suitable: true },
    ]);
  });

  it("can report multiple suitable activities at once", () => {
    const result = evaluateSuitability(
      weather({ temperature: 18, rain: 0, windSpeed: 10, snowDepth: 0 }),
      surf({ waveHeight: 1.2 }),
    );

    const suitableActivities = result
      .filter((r) => r.suitable)
      .map((r) => r.activity);

    expect(suitableActivities.sort()).toEqual(
      ["SURFING", "OUTDOOR_SIGHTSEEING"].sort(),
    );
  });
});
