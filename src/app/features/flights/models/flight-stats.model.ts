export type FlightStatsScopeType = 'flight' | 'climb' | 'segment';

export interface FlightStats {
  id: number;
  flightId: number;

  scopeType: FlightStatsScopeType;

  /**
   * For full flight stats this can be null.
   * For climb stats this is the climb id.
   * For segment stats this can be a custom segment id.
   */
  scopeId: number | null;

  statsVersion: number;

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

  avgSpeedKmh: number;
  maxSpeedKmh: number;

  calculatedAtUtc: string;
}