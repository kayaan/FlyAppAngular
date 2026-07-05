import { Injectable } from '@angular/core';

import { TrackArrays } from '../models/track-arrays.model';
import { ColoredTrackSegment } from '../models/colored-track-segment.model';



const MIN_VARIO_MS = -4;
const MAX_VARIO_MS = 4;

// Sink: weak sink -> strong sink
const WEAK_SINK_COLOR = '#fd0000';
const STRONG_SINK_COLOR = '#840000';

// Climb: weak climb -> strong climb
const WEAK_CLIMB_COLOR = '#00f95b';
const STRONG_CLIMB_COLOR = '#004e1f';


const MIN_SPEED_KMH = 0;
const MAX_SPEED_KMH = 120;

const SPEED_COLOR_STOPS: [number, string][] = [
  [0.0, '#1e3a8a'], // tiefblau - sehr langsam
  [0.2, '#0ea5e9'], // cyan-blau
  [0.4, '#22c55e'], // grün
  [0.6, '#eab308'], // gelb
  [0.8, '#f97316'], // orange
  [1.0, '#dc2626'], // rot - sehr schnell
];

@Injectable({
  providedIn: 'root',
})
export class TrackColorService {

  buildVarioColoredSegments(
    track: TrackArrays | null,
    resolutionSec: number,
  ): ColoredTrackSegment[] {
    if (!track || track.timeSec.length < 2) {
      return [];
    }

    const segments: ColoredTrackSegment[] = [];

    for (let i = 1; i < track.timeSec.length; i++) {
      const previousIndex = this.findPreviousIndexByResolution(
        track.timeSec,
        i,
        resolutionSec,
      );

      const varioMs = this.averageVarioMs(track, previousIndex, i);

      segments.push({
        color: this.getVarioColor(varioMs),
        points: [
          [track.latE7[i - 1] / 10_000_000, track.lonE7[i - 1] / 10_000_000],
          [track.latE7[i] / 10_000_000, track.lonE7[i] / 10_000_000],
        ],
      });
    }

    return segments;
  }

  buildSpeedColoredSegments(
    track: TrackArrays | null,
    resolutionSec: number,
  ): ColoredTrackSegment[] {
    if (!track || track.timeSec.length < 2) {
      return [];
    }

    const segments: ColoredTrackSegment[] = [];

    for (let i = 1; i < track.timeSec.length; i++) {
      const previousIndex = this.findPreviousIndexByResolution(
        track.timeSec,
        i,
        resolutionSec,
      );

      const speedKmh = this.averageSpeedKmh(track, previousIndex, i);

      segments.push({
        color: this.getSpeedColorCss(speedKmh),
        points: [
          [track.latE7[i - 1] / 10_000_000, track.lonE7[i - 1] / 10_000_000],
          [track.latE7[i] / 10_000_000, track.lonE7[i] / 10_000_000],
        ],
      });
    }

    return segments;
  }

  private findPreviousIndexByResolution(
    timeSec: Int32Array,
    currentIndex: number,
    resolutionSec: number,
  ): number {
    const minTimeSec = timeSec[currentIndex] - resolutionSec;

    for (let i = currentIndex; i >= 0; i--) {
      if (timeSec[i] <= minTimeSec) {
        return i;
      }
    }

    return 0;
  }

  private averageVarioMs(
    track: TrackArrays,
    startIndex: number,
    endIndex: number,
  ): number {
    if (endIndex <= startIndex) {
      return 0;
    }

    const durationSec = track.timeSec[endIndex] - track.timeSec[startIndex];

    if (durationSec <= 0) {
      return 0;
    }

    const altitudeDeltaM =
      (track.altGpsCm[endIndex] - track.altGpsCm[startIndex]) / 100;

    return altitudeDeltaM / durationSec;
  }

  private averageSpeedKmh(
    track: TrackArrays,
    startIndex: number,
    endIndex: number,
  ): number {
    if (endIndex <= startIndex) {
      return 0;
    }

    const durationSec = track.timeSec[endIndex] - track.timeSec[startIndex];

    if (durationSec <= 0) {
      return 0;
    }

    let distanceM = 0;

    for (let i = startIndex + 1; i <= endIndex; i++) {
      distanceM += this.distanceMeters(
        track.latE7[i - 1] / 10_000_000,
        track.lonE7[i - 1] / 10_000_000,
        track.latE7[i] / 10_000_000,
        track.lonE7[i] / 10_000_000,
      );
    }

    return (distanceM / durationSec) * 3.6;
  }

  private getVarioColor(varioMs: number): string {
    const clamped = this.clamp(varioMs, MIN_VARIO_MS, MAX_VARIO_MS);

    if (clamped < 0) {
      const t = Math.abs(clamped) / Math.abs(MIN_VARIO_MS);

      return this.interpolateColor(
        WEAK_SINK_COLOR,
        STRONG_SINK_COLOR,
        t,
      );
    }

    const t = clamped / MAX_VARIO_MS;

    return this.interpolateColor(
      WEAK_CLIMB_COLOR,
      STRONG_CLIMB_COLOR,
      t,
    );
  }

  getSpeedColorCss(speedKmh: number): string {
    if (!Number.isFinite(speedKmh)) {
      return SPEED_COLOR_STOPS[0][1];
    }

    const normalized =
      (speedKmh - MIN_SPEED_KMH) / (MAX_SPEED_KMH - MIN_SPEED_KMH);

    const t = this.clamp(normalized, 0, 1);

    return this.interpolateColorStops(SPEED_COLOR_STOPS, t);
  }

  private interpolateColorStops(
    stops: [number, string][],
    t: number
  ): string {
    if (stops.length === 0) {
      return '#64748b';
    }

    if (t <= stops[0][0]) {
      return stops[0][1];
    }

    for (let i = 1; i < stops.length; i++) {
      const [stopT, stopColor] = stops[i];
      const [previousT, previousColor] = stops[i - 1];

      if (t <= stopT) {
        const localT = (t - previousT) / (stopT - previousT);

        return this.interpolateColor(previousColor, stopColor, localT);
      }
    }

    return stops[stops.length - 1][1];
  }



  private clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
  }

  private interpolateColor(from: string, to: string, t: number): string {
    const fromRgb = this.hexToRgb(from);
    const toRgb = this.hexToRgb(to);

    const r = Math.round(fromRgb.r + (toRgb.r - fromRgb.r) * t);
    const g = Math.round(fromRgb.g + (toRgb.g - fromRgb.g) * t);
    const b = Math.round(fromRgb.b + (toRgb.b - fromRgb.b) * t);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private hexToRgb(hex: string): { r: number; g: number; b: number } {
    const value = hex.replace('#', '');

    return {
      r: parseInt(value.substring(0, 2), 16),
      g: parseInt(value.substring(2, 4), 16),
      b: parseInt(value.substring(4, 6), 16),
    };
  }

  private distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
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