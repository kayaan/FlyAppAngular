import { Injectable } from '@angular/core';

import {
  ClimbDetectionSettings,
  DEFAULT_CLIMB_DETECTION_SETTINGS,
} from '../models/flight-settings.model';
import { DetectedClimb } from '../models/detected-climb.model';
import { TrackArrays } from '../models/track-arrays.model';

@Injectable({
  providedIn: 'root',
})
export class ClimbDetectorService {
  detectClimbs(
    track: TrackArrays,
    settings: ClimbDetectionSettings = DEFAULT_CLIMB_DETECTION_SETTINGS
  ): DetectedClimb[] {
    const climbs: DetectedClimb[] = [];

    if (track.timeSec.length < 2) {
      return climbs;
    }

    let startIndex = 0;
    let startAltCm = track.altGpsCm[0];

    let peakIndex = 0;
    let peakAltCm = track.altGpsCm[0];

    for (let i = 1; i < track.timeSec.length; i++) {
      const currentAltCm = track.altGpsCm[i];

      const gainM = (peakAltCm - startAltCm) / 100;
      const dropFromPeakM = (peakAltCm - currentAltCm) / 100;

      if (gainM < settings.minGainM) {
        if (currentAltCm < startAltCm) {
          startIndex = i;
          startAltCm = currentAltCm;

          peakIndex = i;
          peakAltCm = currentAltCm;
          continue;
        }

        if (currentAltCm > peakAltCm) {
          peakIndex = i;
          peakAltCm = currentAltCm;
        }

        continue;
      }

      if (currentAltCm > peakAltCm) {
        peakIndex = i;
        peakAltCm = currentAltCm;
        continue;
      }

      if (dropFromPeakM >= settings.minSeparationDropM) {
        this.addClimbIfValid(climbs, track, startIndex, peakIndex, settings);

        startIndex = i;
        startAltCm = currentAltCm;

        peakIndex = i;
        peakAltCm = currentAltCm;
      }
    }

    this.addClimbIfValid(climbs, track, startIndex, peakIndex, settings);

    return climbs.filter((climb) => climb.gainM >= settings.minGainM);
  }

  private addClimbIfValid(
    climbs: DetectedClimb[],
    track: TrackArrays,
    startIndex: number,
    peakIndex: number,
    settings: ClimbDetectionSettings
  ): void {
    const gainM =
      (track.altGpsCm[peakIndex] - track.altGpsCm[startIndex]) / 100;

    if (gainM < settings.minGainM) {
      return;
    }

    climbs.push(this.createDetectedClimb(track, startIndex, peakIndex));
  }

  private createDetectedClimb(
    track: TrackArrays,
    startIndex: number,
    peakIndex: number
  ): DetectedClimb {
    const startAltM = track.altGpsCm[startIndex] / 100;
    const peakAltM = track.altGpsCm[peakIndex] / 100;

    const startTimeSec = track.timeSec[startIndex];
    const endTimeSec = track.timeSec[peakIndex];

    const durationSec = endTimeSec - startTimeSec;
    const gainM = peakAltM - startAltM;

    const avgClimbMs = durationSec > 0 ? gainM / durationSec : 0;

    return {
      startIndex,
      endIndex: peakIndex,
      peakIndex,

      startTimeSec,
      endTimeSec,
      durationSec,

      gainM,
      avgClimbMs,
      maxClimbMs: avgClimbMs,
    };
  }
}