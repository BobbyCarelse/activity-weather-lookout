import { resolveCityCandidates } from "./cityResolution";
import { GeocodingMatch } from "./types";

function match(overrides: Partial<GeocodingMatch> = {}): GeocodingMatch {
  return {
    name: "Cape Town",
    latitude: -33.92584,
    longitude: 18.42322,
    country: "South Africa",
    admin1: "Western Cape",
    featureCode: "PPLA",
    population: 4772846,
    ...overrides,
  };
}

const capeTownCity = match();
const capeTownAirport = match({
  name: "Cape Town International Airport",
  latitude: -33.96481,
  longitude: 18.60167,
  featureCode: "AIRP",
  population: null,
});
const capeTownshendAU = match({
  name: "Cape Townshend",
  latitude: -22.2,
  longitude: 150.5,
  country: "Australia",
  admin1: "Queensland",
  featureCode: "CAPE",
  population: null,
});

const springfieldIL = match({
  name: "Springfield",
  latitude: 39.8,
  longitude: -89.6,
  admin1: "Illinois",
  country: "United States",
});
const springfieldMO = match({
  name: "Springfield",
  latitude: 37.2,
  longitude: -93.3,
  admin1: "Missouri",
  country: "United States",
});

describe("resolveCityCandidates", () => {
  it("reports not_found when there are no candidates at all", () => {
    expect(resolveCityCandidates([])).toEqual({ status: "not_found" });
  });

  it("resolves directly when there is exactly one candidate", () => {
    expect(resolveCityCandidates([capeTownCity])).toEqual({
      status: "found",
      match: capeTownCity,
    });
  });

  it("filters out non-populated-place candidates before checking for ambiguity", () => {
    // The real "Cape Town" response: the city, its airport, and an unrelated
    // Australian headland matched purely by name coincidence.
    const result = resolveCityCandidates([
      capeTownCity,
      capeTownAirport,
      capeTownshendAU,
    ]);
    expect(result).toEqual({ status: "found", match: capeTownCity });
  });

  it("reports not_found when every candidate is filtered out as non-populated-place", () => {
    const result = resolveCityCandidates([capeTownAirport, capeTownshendAU]);
    expect(result).toEqual({ status: "not_found" });
  });

  it("is ambiguous when populated-place candidates are genuinely far apart", () => {
    const result = resolveCityCandidates([springfieldIL, springfieldMO]);
    expect(result).toEqual({
      status: "ambiguous",
      candidates: [springfieldIL, springfieldMO],
    });
  });

  it("resolves a Coincident Cluster (all within 25km) to the most populous candidate", () => {
    const smallerNeighbor = match({
      name: "Cape Town Central",
      latitude: -33.93,
      longitude: 18.43, // ~1km from capeTownCity
      featureCode: "PPLX",
      population: 50_000,
    });

    const result = resolveCityCandidates([smallerNeighbor, capeTownCity]);
    expect(result).toEqual({ status: "found", match: capeTownCity });
  });

  it("falls back to the first-listed candidate when population data ties or is missing", () => {
    const first = match({ name: "A", population: null });
    const second = match({
      name: "B",
      latitude: -33.93,
      longitude: 18.43,
      population: null,
    });

    const result = resolveCityCandidates([first, second]);
    expect(result).toEqual({ status: "found", match: first });
  });

  it("is ambiguous, not partially clustered, when one populated-place candidate is far from the rest", () => {
    const close = match({
      name: "Cape Town Central",
      latitude: -33.93,
      longitude: 18.43,
      featureCode: "PPLX",
      population: 50_000,
    });

    const result = resolveCityCandidates([capeTownCity, close, springfieldMO]);
    expect(result).toEqual({
      status: "ambiguous",
      candidates: [capeTownCity, close, springfieldMO],
    });
  });
});
