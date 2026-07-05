import { TrackArrays } from '../models/track-arrays.model';

export class TrackMathUtils {
  private static readonly EARTH_RADIUS_M = 6_371_000;
  private static readonly E7 = 10_000_000;

  static cmToM(valueCm: number | undefined | null): number | null {
    if (typeof valueCm !== 'number' || !Number.isFinite(valueCm)) {
      return null;
    }

    return valueCm / 100;
  }

  static e7ToDeg(valueE7: number): number {
    return valueE7 / this.E7;
  }

  static degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  static clampIndex(index: number, maxIndex: number): number {
    return Math.max(0, Math.min(index, maxIndex));
  }

  static haversineDistanceMFromDeg(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    if (
      !Number.isFinite(lat1) ||
      !Number.isFinite(lon1) ||
      !Number.isFinite(lat2) ||
      !Number.isFinite(lon2)
    ) {
      return 0;
    }

    const lat1Rad = this.degToRad(lat1);
    const lat2Rad = this.degToRad(lat2);
    const deltaLatRad = this.degToRad(lat2 - lat1);
    const deltaLonRad = this.degToRad(lon2 - lon1);

    const a =
      Math.sin(deltaLatRad / 2) ** 2 +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLonRad / 2) ** 2;

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return this.EARTH_RADIUS_M * c;
  }

  static haversineDistanceMFromE7(
    lat1E7: number,
    lon1E7: number,
    lat2E7: number,
    lon2E7: number
  ): number {
    return this.haversineDistanceMFromDeg(
      this.e7ToDeg(lat1E7),
      this.e7ToDeg(lon1E7),
      this.e7ToDeg(lat2E7),
      this.e7ToDeg(lon2E7)
    );
  }

  /**
   * Convenience alias for existing flight code.
   *
   * Input format:
   * - latitude and longitude are stored as degrees * 10,000,000
   */
  static distanceMeters(
    lat1E7: number,
    lon1E7: number,
    lat2E7: number,
    lon2E7: number
  ): number {
    return this.haversineDistanceMFromE7(
      lat1E7,
      lon1E7,
      lat2E7,
      lon2E7
    );
  }

  static findPreviousIndexByResolution(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const currentTimeSec = track.timeSec[index];
    const minTimeSec = currentTimeSec - resolutionSec;

    let previousIndex = index;

    while (
      previousIndex > 0 &&
      track.timeSec[previousIndex] > minTimeSec
    ) {
      previousIndex--;
    }

    return previousIndex;
  }

  static averageAltitudeM(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const previousIndex = this.findPreviousIndexByResolution(
      track,
      index,
      resolutionSec
    );

    let sumAltitudeM = 0;
    let count = 0;

    for (let i = previousIndex; i <= index; i++) {
      sumAltitudeM += track.altGpsCm[i] / 100;
      count++;
    }

    return count > 0 ? sumAltitudeM / count : track.altGpsCm[index] / 100;
  }

  static averageVarioMs(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const previousIndex = this.findPreviousIndexByResolution(
      track,
      index,
      resolutionSec
    );

    const deltaAltM =
      (track.altGpsCm[index] - track.altGpsCm[previousIndex]) / 100;

    const deltaTimeSec = track.timeSec[index] - track.timeSec[previousIndex];

    if (deltaTimeSec <= 0) {
      return 0;
    }

    return deltaAltM / deltaTimeSec;
  }

  static averageSpeedKmh(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const previousIndex = this.findPreviousIndexByResolution(
      track,
      index,
      resolutionSec
    );

    const deltaTimeSec = track.timeSec[index] - track.timeSec[previousIndex];

    if (deltaTimeSec <= 0) {
      return 0;
    }

    let distanceM = 0;

    for (let i = previousIndex + 1; i <= index; i++) {
      distanceM += this.distanceMeters(
        track.latE7[i - 1],
        track.lonE7[i - 1],
        track.latE7[i],
        track.lonE7[i]
      );
    }

    return (distanceM / deltaTimeSec) * 3.6;
  }
}