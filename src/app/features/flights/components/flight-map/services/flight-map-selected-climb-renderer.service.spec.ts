import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type * as L from 'leaflet';

import { Climb } from '../../../models/climb.model';
import { TrackArrays } from '../../../models/track-arrays.model';
import { FlightMapPointService } from './flight-map-point.service';
import { FlightMapSelectedClimbRendererService } from './flight-map-selected-climb-renderer.service';

vi.mock('leaflet', async (importOriginal) => {
  const actual = await importOriginal<typeof L>();

  return {
    ...actual,
    polyline: vi.fn(),
  };
});

import * as Leaflet from 'leaflet';

describe('FlightMapSelectedClimbRendererService', () => {
  let service: FlightMapSelectedClimbRendererService;

  let pointServiceMock: {
    buildTrackPoints: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    pointServiceMock = {
      buildTrackPoints: vi.fn(),
    };

    TestBed.configureTestingModule({
      providers: [
        FlightMapSelectedClimbRendererService,
        {
          provide: FlightMapPointService,
          useValue: pointServiceMock,
        },
      ],
    });

    service = TestBed.inject(
      FlightMapSelectedClimbRendererService
    );

    polylineMock().mockReset();
  });

  it('should do nothing when no climb is selected', () => {
    const map = createMapMock();

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      null
    );

    expect(
      pointServiceMock.buildTrackPoints
    ).not.toHaveBeenCalled();

    expect(polylineMock()).not.toHaveBeenCalled();
  });

  it('should do nothing when selected climb does not exist', () => {
    const map = createMapMock();

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      999
    );

    expect(
      pointServiceMock.buildTrackPoints
    ).not.toHaveBeenCalled();

    expect(polylineMock()).not.toHaveBeenCalled();
  });

  it('should request track points for the selected climb', () => {
    const map = createMapMock();
    const track = createTrack();
    const climb = createClimb(7, 10, 20);

    pointServiceMock.buildTrackPoints.mockReturnValue([
      [48, 11],
      [48.1, 11.1],
    ]);

    polylineMock().mockReturnValue(
      createLayerMock()
    );

    service.renderHalo(
      map,
      track,
      [climb],
      7
    );

    expect(
      pointServiceMock.buildTrackPoints
    ).toHaveBeenCalledWith(
      track,
      10,
      20
    );
  });

  it('should not render a halo with fewer than two points', () => {
    const map = createMapMock();

    pointServiceMock.buildTrackPoints.mockReturnValue([
      [48, 11],
    ]);

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      1
    );

    expect(polylineMock()).not.toHaveBeenCalled();
  });

  it('should render the selected climb halo', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    const points: L.LatLngExpression[] = [
      [48, 11],
      [48.1, 11.1],
      [48.2, 11.2],
    ];

    pointServiceMock.buildTrackPoints.mockReturnValue(
      points
    );

    polylineMock().mockReturnValue(layer);

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      1
    );

    expect(polylineMock()).toHaveBeenCalledWith(
      points,
      {
        pane: 'selectedClimbHaloPane',
        color: '#0b26f5',
        weight: 16,
        opacity: 0.96,
        lineCap: 'round',
        lineJoin: 'round',
        interactive: false,
      }
    );

    expect(layer.addTo).toHaveBeenCalledWith(map);
  });

  it('should remove the previous halo before rendering a new one', () => {
    const map = createMapMock();

    const firstLayer = createLayerMock();
    const secondLayer = createLayerMock();

    pointServiceMock.buildTrackPoints.mockReturnValue([
      [48, 11],
      [48.1, 11.1],
    ]);

    polylineMock()
      .mockReturnValueOnce(firstLayer)
      .mockReturnValueOnce(secondLayer);

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      1
    );

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(2, 30, 40)],
      2
    );

    expect(firstLayer.remove).toHaveBeenCalledTimes(1);
    expect(secondLayer.remove).not.toHaveBeenCalled();
  });

  it('should remove the previous halo when selection is cleared', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    pointServiceMock.buildTrackPoints.mockReturnValue([
      [48, 11],
      [48.1, 11.1],
    ]);

    polylineMock().mockReturnValue(layer);

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      1
    );

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      null
    );

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });

  it('should remove the previous halo when selected climb is missing', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    pointServiceMock.buildTrackPoints.mockReturnValue([
      [48, 11],
      [48.1, 11.1],
    ]);

    polylineMock().mockReturnValue(layer);

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      1
    );

    service.renderHalo(
      map,
      createTrack(),
      [],
      1
    );

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });

  it('should clear the current halo', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    pointServiceMock.buildTrackPoints.mockReturnValue([
      [48, 11],
      [48.1, 11.1],
    ]);

    polylineMock().mockReturnValue(layer);

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      1
    );

    service.clearHalo();

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });

  it('should not remove the same halo twice', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    pointServiceMock.buildTrackPoints.mockReturnValue([
      [48, 11],
      [48.1, 11.1],
    ]);

    polylineMock().mockReturnValue(layer);

    service.renderHalo(
      map,
      createTrack(),
      [createClimb(1, 10, 20)],
      1
    );

    service.clearHalo();
    service.clearHalo();

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });

  it('should allow clearing before any halo was rendered', () => {
    expect(() => service.clearHalo()).not.toThrow();
  });
});

function polylineMock() {
  return vi.mocked(Leaflet.polyline);
}

function createMapMock(): L.Map {
  return {} as L.Map;
}

function createLayerMock(): L.Polyline {
  const layer = {
    addTo: vi.fn(),
    remove: vi.fn(),
  } as unknown as L.Polyline;

  vi.mocked(layer.addTo).mockReturnValue(layer);

  return layer;
}

function createClimb(
  id: number,
  startIndex: number,
  endIndex: number
): Climb {
  return {
    id,
    flightId: 'flight-1',

    startIndex,
    endIndex,
    peakIndex: endIndex,

    startTimeSec: 0,
    endTimeSec: 0,
    durationSec: 0,

    gainM: 0,
    avgClimbMs: 0,
    maxClimbMs: 0,
  };
}

function createTrack(): TrackArrays {
  return {
    timeSec: new Int32Array([0, 10, 20]),
    latE7: new Int32Array([
      480_000_000,
      481_000_000,
      482_000_000,
    ]),
    lonE7: new Int32Array([
      110_000_000,
      111_000_000,
      112_000_000,
    ]),
    altGpsCm: new Int32Array([
      50_000,
      55_000,
      60_000,
    ]),
    altBaroCm: new Int32Array([
      49_000,
      54_000,
      59_000,
    ]),
  };
}