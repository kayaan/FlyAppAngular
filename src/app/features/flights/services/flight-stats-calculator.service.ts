import { Injectable } from '@angular/core';

import { CalculatedFlightStats } from '../models/calculated-flight-stats.model';
import { TrackArrays } from '../models/track-arrays.model';
import { TrackMathUtils } from './track-math-utils';

@Injectable({
  providedIn: 'root',
})
export class FlightStatsCalculatorService {
  /**
   * Calculates basic statistics for a complete flight or a selected track segment.
   *
   * Can be reused for:
   * - full flight stats
   * - climb stats
   * - selected segment stats
   */
  calculate(
    track: TrackArrays,
    startIndex = 0,
    endIndex = track.timeSec.length - 1
  ): CalculatedFlightStats {
    if (
      track.timeSec.length === 0 ||
      startIndex < 0 ||
      endIndex >= track.timeSec.length ||
      startIndex >= endIndex
    ) {
      return this.emptyStats();
    }

    let distanceM = 0;

    let minAltGpsCm = Number.POSITIVE_INFINITY;
    let maxAltGpsCm = Number.NEGATIVE_INFINITY;

    let minAltBaroCm = Number.POSITIVE_INFINITY;
    let maxAltBaroCm = Number.NEGATIVE_INFINITY;

    for (let i = startIndex; i <= endIndex; i++) {
      const altGpsCm = track.altGpsCm[i];
      const altBaroCm = track.altBaroCm[i];

      minAltGpsCm = Math.min(minAltGpsCm, altGpsCm);
      maxAltGpsCm = Math.max(maxAltGpsCm, altGpsCm);

      minAltBaroCm = Math.min(minAltBaroCm, altBaroCm);
      maxAltBaroCm = Math.max(maxAltBaroCm, altBaroCm);

      if (i > startIndex) {
        distanceM += TrackMathUtils.distanceMeters(
          track.latE7[i - 1],
          track.lonE7[i - 1],
          track.latE7[i],
          track.lonE7[i]
        );
      }
    }

    const startTimeSec = track.timeSec[startIndex];
    const endTimeSec = track.timeSec[endIndex];
    const durationSec = Math.max(0, endTimeSec - startTimeSec);

    return {
      startIndex,
      endIndex,
      fixCount: endIndex - startIndex + 1,

      startTimeSec,
      endTimeSec,
      durationSec,

      distanceM,

      minAltGpsM: minAltGpsCm / 100,
      maxAltGpsM: maxAltGpsCm / 100,
      gainGpsM: (maxAltGpsCm - minAltGpsCm) / 100,

      minAltBaroM: minAltBaroCm / 100,
      maxAltBaroM: maxAltBaroCm / 100,
      gainBaroM: (maxAltBaroCm - minAltBaroCm) / 100,
    };
  }

  /**
   * Returns an empty stats object for invalid or empty tracks.
   */
  private emptyStats(): CalculatedFlightStats {
    return {
      startIndex: 0,
      endIndex: 0,
      fixCount: 0,

      startTimeSec: 0,
      endTimeSec: 0,
      durationSec: 0,

      distanceM: 0,

      minAltGpsM: 0,
      maxAltGpsM: 0,
      gainGpsM: 0,

      minAltBaroM: 0,
      maxAltBaroM: 0,
      gainBaroM: 0,
    };
  }
}