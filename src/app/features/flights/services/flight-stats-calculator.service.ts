import { Injectable } from '@angular/core';
import { TrackArrays } from '../models/track-arrays.model';
import { CalculatedFlightStats } from '../models/calculated-flight-stats.model';

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

    let maxSpeedKmh = 0;

    for (let i = startIndex; i <= endIndex; i++) {
      const altGpsCm = track.altGpsCm[i];
      const altBaroCm = track.altBaroCm[i];

      minAltGpsCm = Math.min(minAltGpsCm, altGpsCm);
      maxAltGpsCm = Math.max(maxAltGpsCm, altGpsCm);

      minAltBaroCm = Math.min(minAltBaroCm, altBaroCm);
      maxAltBaroCm = Math.max(maxAltBaroCm, altBaroCm);

      if (i > startIndex) {
        const segmentDistanceM = this.distanceMeters(
          track.latE7[i - 1],
          track.lonE7[i - 1],
          track.latE7[i],
          track.lonE7[i]
        );

        distanceM += segmentDistanceM;

        const deltaTimeSec = track.timeSec[i] - track.timeSec[i - 1];

        if (deltaTimeSec > 0) {
          const speedKmh = (segmentDistanceM / deltaTimeSec) * 3.6;
          maxSpeedKmh = Math.max(maxSpeedKmh, speedKmh);
        }
      }
    }

    const startTimeSec = track.timeSec[startIndex];
    const endTimeSec = track.timeSec[endIndex];
    const durationSec = endTimeSec - startTimeSec;

    const avgSpeedKmh = durationSec > 0 ? (distanceM / durationSec) * 3.6 : 0;

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

      avgSpeedKmh,
      maxSpeedKmh,
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

      avgSpeedKmh: 0,
      maxSpeedKmh: 0,
    };
  }

  /**
   * Calculates distance between two coordinates using the haversine formula.
   *
   * Input format:
   * - latitude and longitude are stored as degrees * 10,000,000
   */
  private distanceMeters(
    lat1E7: number,
    lon1E7: number,
    lat2E7: number,
    lon2E7: number
  ): number {
    const earthRadiusM = 6_371_000;

    const lat1 = this.toRadians(lat1E7 / 10_000_000);
    const lon1 = this.toRadians(lon1E7 / 10_000_000);
    const lat2 = this.toRadians(lat2E7 / 10_000_000);
    const lon2 = this.toRadians(lon2E7 / 10_000_000);

    const deltaLat = lat2 - lat1;
    const deltaLon = lon2 - lon1;

    const a =
      Math.sin(deltaLat / 2) ** 2 +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusM * c;
  }

  private toRadians(degrees: number): number {
    return (degrees * Math.PI) / 180;
  }
}