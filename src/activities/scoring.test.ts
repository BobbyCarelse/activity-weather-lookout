import { scoreBand, evaluateWeeklyScores } from "./scoring";
import { ForecastDaySurf, ForecastDayWeather } from "../weather/types";

describe("scoreBand", () => {
  it("scores 100 inside the ideal band", () => {
    expect(scoreBand(-10, [-15, -5], [-20, 2])).toBe(100);
  });

  it("scores 0 outside the acceptable band", () => {
    expect(scoreBand(10, [-15, -5], [-20, 2])).toBe(0);
    expect(scoreBand(-30, [-15, -5], [-20, 2])).toBe(0);
  });

  it("scales linearly between the ideal and acceptable edges", () => {
    // halfway between idealMax (-5) and acceptableMax (2) -> -1.5
    expect(scoreBand(-1.5, [-15, -5], [-20, 2])).toBeCloseTo(50);
    // halfway between acceptableMin (-20) and idealMin (-15) -> -17.5
    expect(scoreBand(-17.5, [-15, -5], [-20, 2])).toBeCloseTo(50);
  });

  it("handles a one-sided ceiling band (ideal/acceptable share a floor)", () => {
    expect(scoreBand(10, [0, 15], [0, 30])).toBe(100);
    expect(scoreBand(35, [0, 15], [0, 30])).toBe(0);
    // halfway between idealMax (15) and acceptableMax (30) -> 22.5
    expect(scoreBand(22.5, [0, 15], [0, 30])).toBeCloseTo(50);
  });

  it("handles a zero-width ideal band (e.g. rain, where only 0 is truly ideal)", () => {
    expect(scoreBand(0, [0, 0], [0, 2.5])).toBe(100);
    expect(scoreBand(2.5, [0, 0], [0, 2.5])).toBe(0);
    expect(scoreBand(1.25, [0, 0], [0, 2.5])).toBeCloseTo(50);
  });
});

function forecastDay(overrides: Partial<ForecastDayWeather> = {}): ForecastDayWeather {
  return {
    date: "2026-08-26",
    temperatureMean: 18,
    rainSum: 0,
    snowfallSum: 0,
    windSpeedMax: 10,
    ...overrides,
  };
}

function surfDay(overrides: Partial<ForecastDaySurf> = {}): ForecastDaySurf {
  return {
    date: "2026-08-26",
    waveHeightMax: 1.2,
    ...overrides,
  };
}

describe("evaluateWeeklyScores", () => {
  it("scores a perfect ski day at 100 even without fresh snowfall", () => {
    const days = [forecastDay({ temperatureMean: -10, snowfallSum: 0 })];
    const result = evaluateWeeklyScores(days, [null]);
    expect(result.SKIING[0].score).toBe(100);
  });

  it("gives skiing a bonus, capped at 100, for forecast snowfall", () => {
    const noSnow = evaluateWeeklyScores(
      [forecastDay({ temperatureMean: -1 })],
      [null],
    ).SKIING[0].score;
    const withSnow = evaluateWeeklyScores(
      [forecastDay({ temperatureMean: -1, snowfallSum: 10 })],
      [null],
    ).SKIING[0].score;

    expect(withSnow).toBeGreaterThan(noSnow);
    expect(withSnow).toBeLessThanOrEqual(100);
  });

  it("zeroes out skiing when it's actively raining regardless of temperature", () => {
    const days = [forecastDay({ temperatureMean: -10, rainSum: 5 })];
    const result = evaluateWeeklyScores(days, [null]);
    expect(result.SKIING[0].score).toBe(0);
  });

  it("zeroes out surfing when there's no Surf Conditions data for that day", () => {
    const days = [forecastDay()];
    const result = evaluateWeeklyScores(days, [null]);
    expect(result.SURFING[0].score).toBe(0);
  });

  it("takes the minimum across surfing's variables (good waves, bad wind)", () => {
    const days = [forecastDay({ windSpeedMax: 40 })];
    const surfDays = [surfDay({ waveHeightMax: 1.2 })];
    const result = evaluateWeeklyScores(days, surfDays);
    expect(result.SURFING[0].score).toBe(0);
  });

  it("makes indoor sightseeing's score the complement of outdoor's", () => {
    const days = [forecastDay({ temperatureMean: 18, rainSum: 0, windSpeedMax: 10 })];
    const result = evaluateWeeklyScores(days, [null]);
    expect(result.INDOOR_SIGHTSEEING[0].score).toBe(
      100 - result.OUTDOOR_SIGHTSEEING[0].score,
    );
  });

  it("returns Forecast Days in chronological order, not sorted by score", () => {
    const days = [
      forecastDay({ date: "2026-08-26", temperatureMean: -30 }), // bad ski day
      forecastDay({ date: "2026-08-27", temperatureMean: -10 }), // great ski day
    ];
    const result = evaluateWeeklyScores(days, [null, null]);
    expect(result.SKIING.map((d) => d.date)).toEqual([
      "2026-08-26",
      "2026-08-27",
    ]);
  });

  it("includes the raw values alongside each score", () => {
    const days = [forecastDay({ temperatureMean: -10 })];
    const result = evaluateWeeklyScores(days, [null]);
    expect(result.SKIING[0].raw).toEqual(days[0]);
  });
});
