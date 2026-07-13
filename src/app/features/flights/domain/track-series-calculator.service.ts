import { Injectable } from '@angular/core';

import { TrackArrays } from '../models/track-arrays.model';
import { TrackMathUtils } from '../domain/track-math-utils';

@Injectable({
  providedIn: 'root',
})
export class TrackSeriesCalculatorService {
  averageVarioMs(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    return TrackMathUtils.averageVarioMs(track, index, resolutionSec);
  }
}