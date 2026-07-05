import { Injectable } from '@angular/core';

import { Climb } from '../models/climb.model';
import {
  DerivedFlightStats,
  StatsScopeType,
  StatsSelection,
} from '../models/derived-flight-stats.model';
import { TrackArrays } from '../models/track-arrays.model';
import { TrackMathUtils } from './track-math-utils';

@Injectable({
  providedIn: 'root',
})
export class DerivedFlightStatsService {
  derive(
    track: TrackArrays | null,
    climbs: Climb[],
    selection: StatsSelection
  ): DerivedFlightStats | null {
    if (!track || track.timeSec.length === 0) {
      return null;
    }

    if (selection.type === 'climb') {
      const climb = climbs.find((c) => c.id === selection.climbId);

      if (!climb) {
        return null;
      }

      return this.calculateRange(
        track,
        climbs,
        'climb',
        climb.id,
        climb.startIndex,
        climb.endIndex
      );
    }

    if (selection.type === 'range') {
      return this.calculateRange(
        track,
        climbs,
        'range',
        null,
        selection.startIndex,
        selection.endIndex
      );
    }

    return this.calculateRange(
      track,
      climbs,
      'flight',
      null,
      0,
      track.timeSec.length - 1
    );
  }

  private calculateRange(
    track: TrackArrays,
    climbs: Climb[],
    scopeType: StatsScopeType,
    scopeId: number | null,
    rawStartIndex: number,
    rawEndIndex: number
  ): DerivedFlightStats {
    const maxIndex = track.timeSec.length - 1;

    const startIndex = TrackMathUtils.clampIndex(
      Math.min(rawStartIndex, rawEndIndex),
      maxIndex
    );

    const endIndex = TrackMathUtils.clampIndex(
      Math.max(rawStartIndex, rawEndIndex),
      maxIndex
    );

    const startTimeSec = track.timeSec[startIndex];
    const endTimeSec = track.timeSec[endIndex];
    const durationSec = Math.max(0, endTimeSec - startTimeSec);

    const altitudeStartM = TrackMathUtils.cmToM(track.altGpsCm[startIndex]);
    const altitudeEndM = TrackMathUtils.cmToM(track.altGpsCm[endIndex]);

    let altitudeMinM: number | null = null;
    let altitudeMaxM: number | null = null;
    let altitudeGainM = 0;
    let altitudeLossM = 0;

    let distanceM = 0;
    let maxSpeedKmh: number | null = null;

    let varioSum = 0;
    let varioCount = 0;
    let minVarioMs: number | null = null;
    let maxVarioMs: number | null = null;

    for (let i = startIndex; i <= endIndex; i++) {
      const altM = TrackMathUtils.cmToM(track.altGpsCm[i]);

      if (altM !== null) {
        altitudeMinM =
          altitudeMinM === null ? altM : Math.min(altitudeMinM, altM);

        altitudeMaxM =
          altitudeMaxM === null ? altM : Math.max(altitudeMaxM, altM);
      }

      if (i === startIndex) {
        continue;
      }

      const prevAltM = TrackMathUtils.cmToM(track.altGpsCm[i - 1]);
      const dt = track.timeSec[i] - track.timeSec[i - 1];

      if (prevAltM !== null && altM !== null) {
        const diffM = altM - prevAltM;

        if (diffM > 0) {
          altitudeGainM += diffM;
        } else {
          altitudeLossM += Math.abs(diffM);
        }

        if (dt > 0) {
          const varioMs = diffM / dt;

          varioSum += varioMs;
          varioCount++;

          minVarioMs =
            minVarioMs === null ? varioMs : Math.min(minVarioMs, varioMs);

          maxVarioMs =
            maxVarioMs === null ? varioMs : Math.max(maxVarioMs, varioMs);
        }
      }

      const segmentDistanceM = TrackMathUtils.distanceMeters(
        track.latE7[i - 1],
        track.lonE7[i - 1],
        track.latE7[i],
        track.lonE7[i]
      );

      distanceM += segmentDistanceM;

      if (dt > 0) {
        const speedKmh = (segmentDistanceM / dt) * 3.6;

        maxSpeedKmh =
          maxSpeedKmh === null ? speedKmh : Math.max(maxSpeedKmh, speedKmh);
      }
    }

    const altitudeDeltaM =
      altitudeStartM !== null && altitudeEndM !== null
        ? altitudeEndM - altitudeStartM
        : null;

    const avgSpeedKmh =
      durationSec > 0 && distanceM > 0 ? (distanceM / durationSec) * 3.6 : null;

    const avgVarioMs = varioCount > 0 ? varioSum / varioCount : null;

    const climbCount = climbs.filter(
      (c) => c.startIndex >= startIndex && c.endIndex <= endIndex
    ).length;

    return {
      scopeType,
      scopeId,

      startIndex,
      endIndex,
      startTimeSec,
      endTimeSec,
      durationSec,

      distanceM,
      fixCount: endIndex - startIndex + 1,

      altitudeStartM,
      altitudeEndM,
      altitudeMinM,
      altitudeMaxM,
      altitudeDeltaM,
      altitudeGainM,
      altitudeLossM,

      avgSpeedKmh,
      maxSpeedKmh,

      avgVarioMs,
      minVarioMs,
      maxVarioMs,

      climbCount,
    };
  }
}