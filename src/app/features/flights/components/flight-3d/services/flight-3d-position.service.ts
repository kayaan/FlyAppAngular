import { Injectable } from '@angular/core';

import { Cartesian3 } from 'cesium';

import { TrackArrays } from '../../../models/track-arrays.model';

export interface Flight3dPositionOptions {
  trackAltitudeOffsetM: number;
  verticalExaggeration: number;
  verticalExaggerationRelativeHeight: number;
}

@Injectable()
export class Flight3dPositionService {
  getPointCount(track: TrackArrays): number {
    return Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length,
      track.timeSec.length
    );
  }

  clampIndex(track: TrackArrays, index: number): number {
    const pointCount = this.getPointCount(track);

    if (pointCount === 0) {
      return 0;
    }

    return Math.max(0, Math.min(index, pointCount - 1));
  }

  buildPosition(
    track: TrackArrays,
    index: number,
    options: Flight3dPositionOptions
  ): Cartesian3 | null {
    const pointCount = this.getPointCount(track);

    if (pointCount === 0) {
      return null;
    }

    const safeIndex = this.clampIndex(track, index);

    const lat = track.latE7[safeIndex] / 10_000_000;
    const lon = track.lonE7[safeIndex] / 10_000_000;
    const rawAltitudeM = track.altGpsCm[safeIndex] / 100;
    const altitudeM = this.exaggerateHeight(rawAltitudeM, options);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(altitudeM)
    ) {
      return null;
    }

    if (lat === 0 && lon === 0) {
      return null;
    }

    return Cartesian3.fromDegrees(lon, lat, altitudeM);
  }

  exaggerateHeight(
    heightM: number,
    options: Flight3dPositionOptions
  ): number {
    return (
      options.trackAltitudeOffsetM +
      options.verticalExaggerationRelativeHeight +
      (heightM - options.verticalExaggerationRelativeHeight) *
        options.verticalExaggeration
    );
  }
}