import { Coordinates, GeocodingMatch } from "./types";

const EARTH_RADIUS_KM = 6371;

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function haversineDistanceKm(a: Coordinates, b: Coordinates): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLon = toRadians(b.longitude - a.longitude);
  const lat1 = toRadians(a.latitude);
  const lat2 = toRadians(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h));
}

// Candidates outside this radius of every other candidate can't be a
// Coincident Cluster — grounded in the real Cape Town city <-> airport
// distance (17km) with headroom, per CONTEXT.md.
const COINCIDENT_CLUSTER_RADIUS_KM = 25;

function isPopulatedPlace(candidate: GeocodingMatch): boolean {
  return candidate.featureCode.startsWith("PPL");
}

function isCoincidentCluster(candidates: GeocodingMatch[]): boolean {
  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      if (haversineDistanceKm(candidates[i], candidates[j]) > COINCIDENT_CLUSTER_RADIUS_KM) {
        return false;
      }
    }
  }
  return true;
}

function mostPopulous(candidates: GeocodingMatch[]): GeocodingMatch {
  return candidates.reduce((best, candidate) =>
    (candidate.population ?? -1) > (best.population ?? -1) ? candidate : best,
  );
}

export type CityResolution =
  | { status: "found"; match: GeocodingMatch }
  | { status: "not_found" }
  | { status: "ambiguous"; candidates: GeocodingMatch[] };

export function resolveCityCandidates(
  matches: GeocodingMatch[],
): CityResolution {
  const populatedPlaces = matches.filter(isPopulatedPlace);

  if (populatedPlaces.length === 0) return { status: "not_found" };
  if (populatedPlaces.length === 1) {
    return { status: "found", match: populatedPlaces[0] };
  }
  if (isCoincidentCluster(populatedPlaces)) {
    return { status: "found", match: mostPopulous(populatedPlaces) };
  }
  return { status: "ambiguous", candidates: populatedPlaces };
}
