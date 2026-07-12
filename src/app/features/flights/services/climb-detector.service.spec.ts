import { beforeEach, describe, expect, it } from 'vitest';

import { ClimbDetectionSettings } from '../models/flight-settings.model';
import { TrackArrays } from '../models/track-arrays.model';
import { ClimbDetectorService } from './climb-detector.service';

describe('ClimbDetectorService', () => {
  let service: ClimbDetectorService;

  const settings: ClimbDetectionSettings = {
    minGainM: 50,
    minSeparationDropM: 80,
  };

  beforeEach(() => {
    service = new ClimbDetectorService();
  });

  it('should return no climbs for an empty track', () => {
    const result = service.detectClimbs(
      createTrack([], []),
      settings
    );

    expect(result).toEqual([]);
  });

  it('should return no climbs for a track with only one point', () => {
    const result = service.detectClimbs(
      createTrack([100], [100]),
      settings
    );

    expect(result).toEqual([]);
  });

  it('should detect a climb that ends at the end of the track', () => {
    const track = createTrack(
      [100, 110, 120],
      [100, 120, 160]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(1);

    expect(result[0]).toEqual({
      startIndex: 0,
      endIndex: 2,
      peakIndex: 2,

      startTimeSec: 100,
      endTimeSec: 120,
      durationSec: 20,

      gainM: 60,
      avgClimbMs: 3,
      maxClimbMs: 3,
    });
  });

  it('should use the lowest point before the climb as start', () => {
    const track = createTrack(
      [100, 110, 120, 130],
      [120, 100, 130, 160]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(1);

    expect(result[0].startIndex).toBe(1);
    expect(result[0].peakIndex).toBe(3);
    expect(result[0].gainM).toBe(60);
    expect(result[0].durationSec).toBe(20);
    expect(result[0].avgClimbMs).toBe(3);
  });

  it('should detect a climb with exactly the minimum gain', () => {
    const track = createTrack(
      [0, 10, 20],
      [100, 125, 150]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(1);
    expect(result[0].gainM).toBe(50);
  });

  it('should ignore a climb below the minimum gain', () => {
    const track = createTrack(
      [0, 10, 20],
      [100, 125, 149]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toEqual([]);
  });

  it('should split two climbs after the required separation drop', () => {
    const track = createTrack(
      [0, 10, 20, 30, 40, 50],
      [100, 160, 180, 90, 120, 170]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(2);

    expect(result[0]).toEqual({
      startIndex: 0,
      endIndex: 2,
      peakIndex: 2,

      startTimeSec: 0,
      endTimeSec: 20,
      durationSec: 20,

      gainM: 80,
      avgClimbMs: 4,
      maxClimbMs: 4,
    });

    expect(result[1]).toEqual({
      startIndex: 3,
      endIndex: 5,
      peakIndex: 5,

      startTimeSec: 30,
      endTimeSec: 50,
      durationSec: 20,

      gainM: 80,
      avgClimbMs: 4,
      maxClimbMs: 4,
    });
  });

  it('should split climbs when the drop equals the separation threshold', () => {
    const track = createTrack(
      [0, 10, 20, 30, 40],
      [100, 150, 180, 100, 160]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(2);

    expect(result[0].startIndex).toBe(0);
    expect(result[0].peakIndex).toBe(2);
    expect(result[0].gainM).toBe(80);

    expect(result[1].startIndex).toBe(3);
    expect(result[1].peakIndex).toBe(4);
    expect(result[1].gainM).toBe(60);
  });

  it('should not split a climb when the drop is below the separation threshold', () => {
    const track = createTrack(
      [0, 10, 20, 30, 40],
      [100, 160, 180, 120, 190]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(1);

    expect(result[0].startIndex).toBe(0);
    expect(result[0].peakIndex).toBe(4);
    expect(result[0].gainM).toBe(90);
  });

  it('should finish the climb at the peak before the separation drop', () => {
    const track = createTrack(
      [0, 10, 20, 30],
      [100, 160, 190, 100]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(1);

    expect(result[0].startIndex).toBe(0);
    expect(result[0].endIndex).toBe(2);
    expect(result[0].peakIndex).toBe(2);

    expect(result[0].endTimeSec).toBe(20);
    expect(result[0].gainM).toBe(90);
  });

  it('should calculate average climb rate from gain and duration', () => {
    const track = createTrack(
      [100, 120, 140],
      [500, 540, 600]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(1);

    expect(result[0].gainM).toBe(100);
    expect(result[0].durationSec).toBe(40);
    expect(result[0].avgClimbMs).toBe(2.5);
    expect(result[0].maxClimbMs).toBe(2.5);
  });

  it('should return zero climb rate when duration is zero', () => {
    const track = createTrack(
      [100, 100],
      [100, 160]
    );

    const result = service.detectClimbs(track, settings);

    expect(result).toHaveLength(1);

    expect(result[0].durationSec).toBe(0);
    expect(result[0].avgClimbMs).toBe(0);
    expect(result[0].maxClimbMs).toBe(0);
  });

  it('should respect custom detection settings', () => {
    const customSettings: ClimbDetectionSettings = {
      minGainM: 100,
      minSeparationDropM: 30,
    };

    const track = createTrack(
      [0, 10, 20, 30, 40, 50],
      [100, 160, 220, 180, 230, 280]
    );

    const result = service.detectClimbs(
      track,
      customSettings
    );

    expect(result).toHaveLength(2);

    expect(result[0].startIndex).toBe(0);
    expect(result[0].peakIndex).toBe(2);
    expect(result[0].gainM).toBe(120);

    expect(result[1].startIndex).toBe(3);
    expect(result[1].peakIndex).toBe(5);
    expect(result[1].gainM).toBe(100);
  });
});

function createTrack(
  timeSec: number[],
  altitudeM: number[]
): TrackArrays {
  const pointCount = Math.max(
    timeSec.length,
    altitudeM.length
  );

  return {
    timeSec: new Int32Array(timeSec),
    latE7: new Int32Array(pointCount),
    lonE7: new Int32Array(pointCount),
    altGpsCm: new Int32Array(
      altitudeM.map((value) => value * 100)
    ),
    altBaroCm: new Int32Array(pointCount),
  };
}