import { Injectable } from '@angular/core';

import { Climb } from '../models/climb.model';
import {
  DerivedFlightStats,
  StatsScopeType,
  StatsSelection,
} from '../models/derived-flight-stats.model';
import { TrackArrays } from '../models/track-arrays.model';

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

    const startIndex = this.clampIndex(
      Math.min(rawStartIndex, rawEndIndex),
      maxIndex
    );

    const endIndex = this.clampIndex(
      Math.max(rawStartIndex, rawEndIndex),
      maxIndex
    );

    const startTimeSec = track.timeSec[startIndex];
    const endTimeSec = track.timeSec[endIndex];
    const durationSec = Math.max(0, endTimeSec - startTimeSec);

    const altitudeStartM = this.cmToM(track.altGpsCm[startIndex]);
    const altitudeEndM = this.cmToM(track.altGpsCm[endIndex]);

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
      const altM = this.cmToM(track.altGpsCm[i]);

      if (altM !== null) {
        altitudeMinM =
          altitudeMinM === null ? altM : Math.min(altitudeMinM, altM);

        altitudeMaxM =
          altitudeMaxM === null ? altM : Math.max(altitudeMaxM, altM);
      }

      if (i === startIndex) {
        continue;
      }

      const prevAltM = this.cmToM(track.altGpsCm[i - 1]);
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

      const prevLat = track.latE7[i - 1] / 10_000_000;
      const prevLon = track.lonE7[i - 1] / 10_000_000;
      const lat = track.latE7[i] / 10_000_000;
      const lon = track.lonE7[i] / 10_000_000;

      const segmentDistanceM = this.haversineDistanceM(
        prevLat,
        prevLon,
        lat,
        lon
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

  private cmToM(valueCm: number | undefined): number | null {
    if (typeof valueCm !== 'number' || !Number.isFinite(valueCm)) {
      return null;
    }

    return valueCm / 100;
  }

  private clampIndex(index: number, maxIndex: number): number {
    return Math.max(0, Math.min(index, maxIndex));
  }

  private haversineDistanceM(
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

    const earthRadiusM = 6_371_000;

    const lat1Rad = this.degToRad(lat1);
    const lat2Rad = this.degToRad(lat2);
    const deltaLatRad = this.degToRad(lat2 - lat1);
    const deltaLonRad = this.degToRad(lon2 - lon1);

    const a =
      Math.sin(deltaLatRad / 2) * Math.sin(deltaLatRad / 2) +
      Math.cos(lat1Rad) *
        Math.cos(lat2Rad) *
        Math.sin(deltaLonRad / 2) *
        Math.sin(deltaLonRad / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusM * c;
  }

  private degToRad(value: number): number {
    return (value * Math.PI) / 180;
  }
}