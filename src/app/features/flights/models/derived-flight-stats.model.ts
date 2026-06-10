export type StatsScopeType = 'flight' | 'climb' | 'range';

export type DerivedFlightStats = {
  scopeType: StatsScopeType;
  scopeId: number | null;

  startIndex: number;
  endIndex: number;
  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;

  distanceM: number | null;
  fixCount: number;

  altitudeStartM: number | null;
  altitudeEndM: number | null;
  altitudeMinM: number | null;
  altitudeMaxM: number | null;
  altitudeDeltaM: number | null;
  altitudeGainM: number | null;
  altitudeLossM: number | null;

  avgSpeedKmh: number | null;
  maxSpeedKmh: number | null;

  avgVarioMs: number | null;
  minVarioMs: number | null;
  maxVarioMs: number | null;

  climbCount: number;
};

export type StatsSelection =
  | { type: 'flight' }
  | { type: 'climb'; climbId: number }
  | { type: 'range'; startIndex: number; endIndex: number };