import { Injectable } from '@angular/core';

import { TrackArrays } from '../models/track-arrays.model';
import { TrackMetrics } from '../models/track-metrics.model';
import { TrackMathUtils } from './track-math-utils';

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
      altitudeM[i] = TrackMathUtils.averageAltitudeM(
        track,
        i,
        altitudeResolutionSec
      );

      varioMs[i] = TrackMathUtils.averageVarioMs(
        track,
        i,
        varioResolutionSec
      );

      speedKmh[i] = TrackMathUtils.averageSpeedKmh(
        track,
        i,
        speedResolutionSec
      );
    }

    return {
      altitudeM,
      varioMs,
      speedKmh,
    };
  }
}