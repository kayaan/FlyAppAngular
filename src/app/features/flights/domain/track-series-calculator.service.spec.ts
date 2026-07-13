import { describe, expect, it, vi } from 'vitest';

import { TrackArrays } from '../models/track-arrays.model';
import { TrackMathUtils } from './track-math-utils';
import { TrackSeriesCalculatorService } from './track-series-calculator.service';

describe('TrackSeriesCalculatorService', () => {
  it('should delegate average vario calculation to TrackMathUtils', () => {
    const track: TrackArrays = {
      timeSec: new Int32Array([0, 10]),
      latE7: new Int32Array([0, 0]),
      lonE7: new Int32Array([0, 0]),
      altGpsCm: new Int32Array([10_000, 11_000]),
      altBaroCm: new Int32Array([10_000, 11_000]),
    };

    const spy = vi
      .spyOn(TrackMathUtils, 'averageVarioMs')
      .mockReturnValue(1.25);

    const service = new TrackSeriesCalculatorService();

    const result = service.averageVarioMs(track, 1, 10);

    expect(result).toBe(1.25);
    expect(spy).toHaveBeenCalledWith(track, 1, 10);
  });
});