// "rain ≈ 0" per CONTEXT.md — Open-Meteo reports rain in mm/h, so anything
// below this is noise rather than active rainfall. Shared by the real-time
// Suitability gate and the forecast Suitability Score.
export const NO_RAIN_THRESHOLD_MM = 0.1;
