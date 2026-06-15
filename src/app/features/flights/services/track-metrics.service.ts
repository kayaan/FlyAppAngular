import { Injectable } from '@angular/core';

import { TrackArrays } from '../models/track-arrays.model';
import { TrackMetrics } from '../models/track-metrics.model';

@Injectable({
  providedIn: 'root',
})
export class TrackMetricsService {
  build(
    track: TrackArrays,
    altitudeResolutionSec: number,
    varioResolutionSec: number,
    speedResolutionSec: number
  ): TrackMetrics {
    const pointCount = Math.min(
      track.timeSec.length,
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length
    );

    const altitudeM = new Float32Array(pointCount);
    const varioMs = new Float32Array(pointCount);
    const speedKmh = new Float32Array(pointCount);

    for (let i = 0; i < pointCount; i++) {
      altitudeM[i] = this.averageAltitudeM(track, i, altitudeResolutionSec);
      varioMs[i] = this.averageVarioMs(track, i, varioResolutionSec);
      speedKmh[i] = this.averageSpeedKmh(track, i, speedResolutionSec);
    }

    return {
      altitudeM,
      varioMs,
      speedKmh,
    };
  }

  private averageAltitudeM(
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

  private averageVarioMs(
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

    const deltaTimeSec =
      track.timeSec[index] - track.timeSec[previousIndex];

    if (deltaTimeSec <= 0) {
      return 0;
    }

    return deltaAltM / deltaTimeSec;
  }

  private averageSpeedKmh(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const previousIndex = this.findPreviousIndexByResolution(
      track,
      index,
      resolutionSec
    );

    const deltaTimeSec =
      track.timeSec[index] - track.timeSec[previousIndex];

    if (deltaTimeSec <= 0) {
      return 0;
    }

    let distanceM = 0;

    for (let i = previousIndex + 1; i <= index; i++) {
      distanceM += this.distanceMeters(
        track.latE7[i - 1] / 10_000_000,
        track.lonE7[i - 1] / 10_000_000,
        track.latE7[i] / 10_000_000,
        track.lonE7[i] / 10_000_000
      );
    }

    return (distanceM / deltaTimeSec) * 3.6;
  }

  private findPreviousIndexByResolution(
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

  private distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const earthRadiusM = 6_371_000;

    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
        Math.cos(this.toRad(lat2)) *
        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusM * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }
}