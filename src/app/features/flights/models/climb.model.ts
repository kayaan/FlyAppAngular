export interface Climb {
  id: number;
  flightId: number;

  startIndex: number;
  endIndex: number;
  peakIndex: number;

  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;

  gainM: number;
  avgClimbMs: number;
  maxClimbMs: number;
}