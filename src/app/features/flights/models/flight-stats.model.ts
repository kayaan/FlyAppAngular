export type FlightStatsScopeType = 'flight' | 'climb' | 'segment';

export interface FlightStats {
  id: string; // same as Flight.id = SHA-256(original IGC bytes)

  startIndex: number;
  endIndex: number;
  fixCount: number;

  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;

  distanceM: number;

  minAltGpsM: number;
  maxAltGpsM: number;
  gainGpsM: number;

  minAltBaroM: number;
  maxAltBaroM: number;
  gainBaroM: number;
}