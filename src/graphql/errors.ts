import { GraphQLError } from "graphql";
import { GeocodingMatch } from "../weather/types";

export class CityNotFoundError extends GraphQLError {
  constructor(city: string) {
    super(`No city found matching "${city}".`, {
      extensions: { code: "CITY_NOT_FOUND" },
    });
  }
}

export class AmbiguousCityError extends GraphQLError {
  constructor(city: string, candidates: GeocodingMatch[]) {
    super(
      `"${city}" matches more than one place. Please narrow it down (e.g. by country).`,
      {
        extensions: {
          code: "AMBIGUOUS_CITY_MATCH",
          candidates: candidates.map((c) => ({
            name: c.name,
            admin1: c.admin1,
            country: c.country,
          })),
        },
      },
    );
  }
}
