import { Injectable } from '@angular/core';

import * as L from 'leaflet';

import { TrackArrays } from '../../../models/track-arrays.model';

@Injectable()
export class FlightMapPointService {
  buildTrackPoints(
    track: TrackArrays,
    startIndex: number,
    endIndex: number
  ): L.LatLngExpression[] {
    const points: L.LatLngExpression[] = [];

    const pointCount = Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.timeSec.length
    );

    if (pointCount === 0) {
      return points;
    }

    const safeStartIndex = Math.max(0, Math.min(startIndex, endIndex));
    const safeEndIndex = Math.min(pointCount - 1, Math.max(startIndex, endIndex));

    for (let i = safeStartIndex; i <= safeEndIndex; i++) {
      const point = this.buildPoint(track, i);

      if (!point) {
        continue;
      }

      points.push(point);
    }

    return points;
  }

  buildPoint(track: TrackArrays, index: number): L.LatLngExpression | null {
    const pointCount = Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.timeSec.length
    );

    if (pointCount === 0) {
      return null;
    }

    const safeIndex = Math.max(0, Math.min(index, pointCount - 1));

    const lat = track.latE7[safeIndex] / 10_000_000;
    const lon = track.lonE7[safeIndex] / 10_000_000;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      return null;
    }

    if (lat === 0 && lon === 0) {
      return null;
    }

    return [lat, lon];
  }
}