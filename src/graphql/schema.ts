export const typeDefs = /* GraphQL */ `
  enum Activity {
    SKIING
    SURFING
    OUTDOOR_SIGHTSEEING
    INDOOR_SIGHTSEEING
  }

  type WeatherSnapshot {
    temperature: Float!
    rain: Float!
    snowfall: Float!
    snowDepth: Float!
    windSpeed: Float!
    weatherCode: Int!
    cloudCover: Float!
  }

  type SurfConditions {
    waveHeight: Float!
    wavePeriod: Float!
    swellWaveHeight: Float!
  }

  type ActivitySuitability {
    activity: Activity!
    suitable: Boolean!
  }

  type ActivitySuggestions {
    city: String!
    weather: WeatherSnapshot!
    surfConditions: SurfConditions
    suitability: [ActivitySuitability!]!
  }

  type ForecastDayWeather {
    date: String!
    temperatureMean: Float!
    rainSum: Float!
    snowfallSum: Float!
    windSpeedMax: Float!
  }

  type DailyActivityScore {
    date: String!
    score: Float!
    weather: ForecastDayWeather!
  }

  type ActivityWeeklyScores {
    activity: Activity!
    days: [DailyActivityScore!]!
  }

  type WeeklyForecast {
    city: String!
    activities: [ActivityWeeklyScores!]!
  }

  type Query {
    activitySuggestions(city: String!): ActivitySuggestions!
    weeklyForecast(city: String!): WeeklyForecast!
  }
`;
