import { withTtlCache } from "./cache";

describe("withTtlCache", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("calls the wrapped function once and reuses the result for the same key within the TTL", async () => {
    const fn = jest.fn(async (city: string) => `result for ${city}`);
    const cached = withTtlCache(fn, 1000, (city) => city);

    expect(await cached("Chamonix")).toBe("result for Chamonix");
    expect(await cached("Chamonix")).toBe("result for Chamonix");
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("calls the wrapped function separately for different keys", async () => {
    const fn = jest.fn(async (city: string) => `result for ${city}`);
    const cached = withTtlCache(fn, 1000, (city) => city);

    await cached("Chamonix");
    await cached("Cape Town");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("re-calls the wrapped function once the TTL has elapsed", async () => {
    const fn = jest.fn(async (city: string) => `result for ${city}`);
    const cached = withTtlCache(fn, 1000, (city) => city);

    await cached("Chamonix");
    jest.advanceTimersByTime(1001);
    await cached("Chamonix");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("re-calls the wrapped function after clearCache()", async () => {
    const fn = jest.fn(async (city: string) => `result for ${city}`);
    const cached = withTtlCache(fn, 1000, (city) => city);

    await cached("Chamonix");
    cached.clearCache();
    await cached("Chamonix");

    expect(fn).toHaveBeenCalledTimes(2);
  });

  it("does not cache a rejection, so a failed call can be retried", async () => {
    const fn = jest
      .fn<Promise<string>, [string]>()
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValueOnce("ok");
    const cached = withTtlCache(fn, 1000, (city) => city);

    await expect(cached("Chamonix")).rejects.toThrow("boom");
    await expect(cached("Chamonix")).resolves.toBe("ok");
    expect(fn).toHaveBeenCalledTimes(2);
  });
});
