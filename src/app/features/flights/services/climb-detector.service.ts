import { Injectable } from '@angular/core';
import { TrackArrays } from '../models/track-arrays.model';
import { DetectedClimb } from '../models/detected-climb.model';

@Injectable({
  providedIn: 'root',
})
export class ClimbDetectorService {
  /**
   * Detects climb phases based on GPS altitude.
   *
   * This service only detects climbs.
   * It does not assign ids or flightIds.
   *
   * ids and flightIds belong to import/storage logic.
   */
  detectClimbs(
    track: TrackArrays,
    minGainM = 25,
    allowedDropPercent = 5
  ): DetectedClimb[] {
    const climbs: DetectedClimb[] = [];

    if (track.timeSec.length < 2) {
      return climbs;
    }

    let startIndex = 0;
    let peakIndex = 0;

    let startAltCm = track.altGpsCm[0];
    let peakAltCm = track.altGpsCm[0];

    for (let i = 1; i < track.timeSec.length; i++) {
      const currentAltCm = track.altGpsCm[i];

      // Update the peak while altitude is increasing.
      if (currentAltCm > peakAltCm) {
        peakAltCm = currentAltCm;
        peakIndex = i;
      }

      const gainM = (peakAltCm - startAltCm) / 100;
      const allowedDropM = Math.max(5, gainM * (allowedDropPercent / 100));
      const dropFromPeakM = (peakAltCm - currentAltCm) / 100;

      // If the climb has enough gain and then drops too much,
      // the climb ends at the last peak.
      if (gainM >= minGainM && dropFromPeakM > allowedDropM) {
        climbs.push(this.createDetectedClimb(track, startIndex, peakIndex));

        // Start searching for the next climb from the current point.
        startIndex = i;
        peakIndex = i;
        startAltCm = currentAltCm;
        peakAltCm = currentAltCm;
        continue;
      }

      // If no climb is established yet and altitude drops lower,
      // reset the start point to the current lower altitude.
      if (gainM < minGainM && currentAltCm < startAltCm) {
        startIndex = i;
        peakIndex = i;
        startAltCm = currentAltCm;
        peakAltCm = currentAltCm;
      }
    }

    // Add an unfinished climb at the end if it is large enough.
    const finalGainM = (peakAltCm - startAltCm) / 100;

    if (finalGainM >= minGainM) {
      climbs.push(this.createDetectedClimb(track, startIndex, peakIndex));
    }

    return climbs;
  }

  /**
   * Creates a detected climb from start and peak indexes.
   */
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

      // First simple version.
      // Later we can calculate max climb with a 10s sliding window.
      maxClimbMs: avgClimbMs,
    };
  }
}