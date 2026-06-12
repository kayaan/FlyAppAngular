import { Injectable } from "@angular/core";
import { TrackArrays } from "../models/track-arrays.model";

@Injectable({ providedIn: 'root' })
export class TrackSeriesCalculatorService {
  averageVarioMs(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const previousIndex = this.findPreviousIndexByResolution(
      track,
      index,
      resolutionSec
    );

    const deltaAltM =
      (track.altGpsCm[index] - track.altGpsCm[previousIndex]) / 100;

    const deltaTimeSec = track.timeSec[index] - track.timeSec[previousIndex];

    if (deltaTimeSec <= 0) {
      return 0;
    }

    return deltaAltM / deltaTimeSec;
  }

  private findPreviousIndexByResolution(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const currentTimeSec = track.timeSec[index];
    const minTimeSec = currentTimeSec - resolutionSec;

    let previousIndex = index;

    while (
      previousIndex > 0 &&
      track.timeSec[previousIndex] > minTimeSec
    ) {
      previousIndex--;
    }

    return previousIndex;
  }
}