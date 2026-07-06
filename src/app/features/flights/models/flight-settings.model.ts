// src/app/features/flights/models/flight-settings.model.ts

export type MapTileMode = 'topo' | 'osm';
export type ChartHeightMode = 'auto' | 'compact' | 'large';

export type TrackColorMode = 'vario' | 'speed';

export interface ClimbDetectionSettings {
  minGainM: number;
  minSeparationDropM: number;
}

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

  climbDetectionMinGainM: number;
  climbDetectionMinSeparationDropM: number;
}

export const DEFAULT_CLIMB_DETECTION_SETTINGS: ClimbDetectionSettings = {
  minGainM: 50,
  minSeparationDropM: 80,
};

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

  climbDetectionMinGainM: DEFAULT_CLIMB_DETECTION_SETTINGS.minGainM,
  climbDetectionMinSeparationDropM:
    DEFAULT_CLIMB_DETECTION_SETTINGS.minSeparationDropM,
};