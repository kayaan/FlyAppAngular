import { Injectable } from '@angular/core';

import { TrackArrays } from '../models/track-arrays.model';
import { ColoredTrackSegment } from '../models/colored-track-segment.model';

const MIN_VARIO_MS = -4;
const MAX_VARIO_MS = 4;

const LIGHT_SINK_COLOR = '#fa6f6f'; 
const DARK_CLIMB_COLOR = '#3d0000'; 

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

  private getVarioColor(varioMs: number): string {
    const clamped = this.clamp(varioMs, MIN_VARIO_MS, MAX_VARIO_MS);

    const t =
      (clamped - MIN_VARIO_MS) / (MAX_VARIO_MS - MIN_VARIO_MS);

    return this.interpolateColor(
      LIGHT_SINK_COLOR,
      DARK_CLIMB_COLOR,
      t,
    );
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
}