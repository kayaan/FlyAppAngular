// src/app/features/flights/models/flight-settings.model.ts

export type MapTileMode = 'topo' | 'osm';
export type ChartHeightMode = 'auto' | 'compact' | 'large';

export type TrackColorMode = 'vario' | 'speed';

export interface FlightSettings {
  mapTileMode: MapTileMode;
  showAltitudeChart: boolean;
  showVarioChart: boolean;
  showSpeedChart: boolean;
  chartHeightMode: ChartHeightMode;

  altitudeChartResolutionInSec: number;
  varioChartResolutionInSec: number;
  speedChartResolutionInSec: number;

  trackColorMode: TrackColorMode;

  showStatsPanel: boolean;
  showClimbsOnCharts: boolean;
}

export const DEFAULT_FLIGHT_SETTINGS: FlightSettings = {
  mapTileMode: 'topo',
  showAltitudeChart: true,
  showVarioChart: true,
  showSpeedChart: true,
  chartHeightMode: 'auto',

  altitudeChartResolutionInSec: 2,
  varioChartResolutionInSec: 5,
  speedChartResolutionInSec: 5,

  trackColorMode: 'vario',

  showStatsPanel: false,
  showClimbsOnCharts: false,
};