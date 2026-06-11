import { Injectable } from '@angular/core';
import { TrackArrays } from '../models/track-arrays.model';
import { DetectedClimb } from '../models/detected-climb.model';

@Injectable({
  providedIn: 'root',
})
export class ClimbDetectorService {
  private readonly minGainM = 100;
  private readonly minSeparationDropM = 80;

  /**
   * Detects major climb phases based on GPS altitude.
   *
   * Rules:
   * - a climb must gain at least minGainM
   * - a climb ends only after a real drop from the peak
   * - small bumps inside a larger climb are ignored
   */
  detectClimbs(track: TrackArrays): DetectedClimb[] {
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

      // No valid climb yet: search for the lowest start point.
      if (gainM < this.minGainM) {
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

      // Valid climb exists: keep extending peak.
      if (currentAltCm > peakAltCm) {
        peakIndex = i;
        peakAltCm = currentAltCm;
        continue;
      }

      // End climb only after a real separation drop.
      if (dropFromPeakM >= this.minSeparationDropM) {
        this.addClimbIfValid(climbs, track, startIndex, peakIndex);

        // Restart from current point after the separation drop.
        startIndex = i;
        startAltCm = currentAltCm;

        peakIndex = i;
        peakAltCm = currentAltCm;
      }
    }

    // Final unfinished climb.
    this.addClimbIfValid(climbs, track, startIndex, peakIndex);



    const allClimbs = climbs.filter((climb) => climb.gainM >= this.minGainM);

    return allClimbs;
  }

  private addClimbIfValid(
    climbs: DetectedClimb[],
    track: TrackArrays,
    startIndex: number,
    peakIndex: number
  ): void {
    const gainM =
      (track.altGpsCm[peakIndex] - track.altGpsCm[startIndex]) / 100;

    if (gainM < this.minGainM) {
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