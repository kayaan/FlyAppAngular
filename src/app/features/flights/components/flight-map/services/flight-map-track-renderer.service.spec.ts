import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import type * as Leaflet from 'leaflet';

vi.mock('leaflet', async (importOriginal) => {
  const actual = await importOriginal<typeof Leaflet>();

  return {
    ...actual,
    polyline: vi.fn(),
    latLngBounds: vi.fn(),
  };
});

import * as L from 'leaflet';

import { ColoredTrackSegment } from '../../../models/colored-track-segment.model';
import { FlightMapTrackRendererService } from './flight-map-track-renderer.service';

describe('FlightMapTrackRendererService', () => {
  let service: FlightMapTrackRendererService;

  beforeEach(() => {
    service = new FlightMapTrackRendererService();

    vi.useFakeTimers();

    polylineMock().mockReset();
    latLngBoundsMock().mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should do nothing for empty segments', () => {
    const map = createMapMock();

    service.renderColoredSegments(map, []);

    expect(polylineMock()).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
    expect(map.invalidateSize).not.toHaveBeenCalled();
  });

  it('should render one polyline for every valid segment', () => {
    const map = createMapMock();

    const firstLayer = createLayerMock();
    const secondLayer = createLayerMock();

    polylineMock()
      .mockReturnValueOnce(firstLayer)
      .mockReturnValueOnce(secondLayer);

    const segments: ColoredTrackSegment[] = [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
      {
        color: '#00ff00',
        points: [
          [49, 12],
          [49.1, 12.1],
        ],
      },
    ];

    service.renderColoredSegments(map, segments);

    expect(polylineMock()).toHaveBeenNthCalledWith(
      1,
      segments[0].points,
      {
        pane: 'trackPane',
        color: '#ff0000',
        weight: 5,
        opacity: 0.95,
        interactive: false,
      }
    );

    expect(polylineMock()).toHaveBeenNthCalledWith(
      2,
      segments[1].points,
      {
        pane: 'trackPane',
        color: '#00ff00',
        weight: 5,
        opacity: 0.95,
        interactive: false,
      }
    );

    expect(firstLayer.addTo).toHaveBeenCalledWith(map);
    expect(secondLayer.addTo).toHaveBeenCalledWith(map);
  });

  it('should remove existing layers before rendering new segments', () => {
    const map = createMapMock();

    const firstLayer = createLayerMock();
    const secondLayer = createLayerMock();

    polylineMock()
      .mockReturnValueOnce(firstLayer)
      .mockReturnValueOnce(secondLayer);

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
    ]);

    service.renderColoredSegments(map, [
      {
        color: '#00ff00',
        points: [
          [49, 12],
          [49.1, 12.1],
        ],
      },
    ]);

    expect(firstLayer.remove).toHaveBeenCalledTimes(1);
    expect(secondLayer.remove).not.toHaveBeenCalled();
  });

  it('should remove all tracked layers when clear is called', () => {
    const map = createMapMock();

    const firstLayer = createLayerMock();
    const secondLayer = createLayerMock();

    polylineMock()
      .mockReturnValueOnce(firstLayer)
      .mockReturnValueOnce(secondLayer);

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
      {
        color: '#00ff00',
        points: [
          [49, 12],
          [49.1, 12.1],
        ],
      },
    ]);

    service.clear();

    expect(firstLayer.remove).toHaveBeenCalledTimes(1);
    expect(secondLayer.remove).toHaveBeenCalledTimes(1);
  });

  it('should not remove the same layers again after clear', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    polylineMock().mockReturnValue(layer);

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
    ]);

    service.clear();
    service.clear();

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });

  it('should skip segments with fewer than two valid points', () => {
    const map = createMapMock();

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [0, 0],
        ],
      },
      {
        color: '#00ff00',
        points: [
          [Number.NaN, 12],
          [49, Number.POSITIVE_INFINITY],
        ],
      },
    ]);

    expect(polylineMock()).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('should filter invalid points before rendering', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    polylineMock().mockReturnValue(layer);

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [0, 0],
          [Number.NaN, 12],
          [49, Number.POSITIVE_INFINITY],
          [48.1, 11.1],
        ],
      },
    ]);

    expect(polylineMock()).toHaveBeenCalledWith(
      [
        [48, 11],
        [48.1, 11.1],
      ],
      {
        pane: 'trackPane',
        color: '#ff0000',
        weight: 5,
        opacity: 0.95,
        interactive: false,
      }
    );

    expect(layer.addTo).toHaveBeenCalledWith(map);
  });

  it('should fit bounds using all valid rendered points', () => {
    const map = createMapMock();

    const firstLayer = createLayerMock();
    const secondLayer = createLayerMock();
    const bounds = {} as L.LatLngBounds;

    polylineMock()
      .mockReturnValueOnce(firstLayer)
      .mockReturnValueOnce(secondLayer);

    latLngBoundsMock().mockReturnValue(bounds);

    const expectedPoints: L.LatLngExpression[] = [
      [48, 11],
      [48.1, 11.1],
      [49, 12],
      [49.1, 12.1],
    ];

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
      {
        color: '#00ff00',
        points: [
          [49, 12],
          [49.1, 12.1],
        ],
      },
    ]);

    expect(latLngBoundsMock()).toHaveBeenCalledWith(
      expectedPoints
    );

    expect(map.fitBounds).toHaveBeenCalledWith(
      bounds,
      {
        padding: [24, 24],
      }
    );
  });

  it('should fit bounds only on the first successful render', () => {
    const map = createMapMock();

    const firstLayer = createLayerMock();
    const secondLayer = createLayerMock();

    polylineMock()
      .mockReturnValueOnce(firstLayer)
      .mockReturnValueOnce(secondLayer);

    latLngBoundsMock().mockReturnValue(
      {} as L.LatLngBounds
    );

    const segments: ColoredTrackSegment[] = [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
    ];

    service.renderColoredSegments(map, segments);
    service.renderColoredSegments(map, segments);

    expect(map.fitBounds).toHaveBeenCalledTimes(1);
    expect(latLngBoundsMock()).toHaveBeenCalledTimes(1);
  });

  it('should invalidate the map size asynchronously', async () => {
    const map = createMapMock();
    const layer = createLayerMock();

    polylineMock().mockReturnValue(layer);

    latLngBoundsMock().mockReturnValue(
      {} as L.LatLngBounds
    );

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
    ]);

    expect(map.invalidateSize).not.toHaveBeenCalled();

    await vi.runAllTimersAsync();

    expect(map.invalidateSize).toHaveBeenCalledTimes(1);
  });

  it('should not fit bounds when every segment is invalid', () => {
    const map = createMapMock();

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [0, 0],
          [Number.NaN, Number.NaN],
        ],
      },
    ]);

    expect(polylineMock()).not.toHaveBeenCalled();
    expect(latLngBoundsMock()).not.toHaveBeenCalled();
    expect(map.fitBounds).not.toHaveBeenCalled();
  });

  it('should clear existing layers even when the new segment list is empty', () => {
    const map = createMapMock();
    const layer = createLayerMock();

    polylineMock().mockReturnValue(layer);

    latLngBoundsMock().mockReturnValue(
      {} as L.LatLngBounds
    );

    service.renderColoredSegments(map, [
      {
        color: '#ff0000',
        points: [
          [48, 11],
          [48.1, 11.1],
        ],
      },
    ]);

    service.renderColoredSegments(map, []);

    expect(layer.remove).toHaveBeenCalledTimes(1);
  });
});

function polylineMock() {
  return vi.mocked(L.polyline);
}

function latLngBoundsMock() {
  return vi.mocked(L.latLngBounds);
}

function createMapMock(): L.Map {
  return {
    fitBounds: vi.fn(),
    invalidateSize: vi.fn(),
  } as unknown as L.Map;
}

function createLayerMock(): L.Polyline {
  const layer = {
    addTo: vi.fn(),
    remove: vi.fn(),
  } as unknown as L.Polyline;

  vi.mocked(layer.addTo).mockReturnValue(layer);

  return layer;
}
