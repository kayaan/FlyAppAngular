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

  threeDVerticalExaggeration: number;
  threeDVerticalExaggerationRelativeHeight: number;
  threeDTrackAltitudeOffsetM: number;
  threeDRenderStep: number;
  threeDVarioClassCount: number;
  threeDMaxVarioForColorMs: number;
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

  threeDVerticalExaggeration: 2.0,
  threeDVerticalExaggerationRelativeHeight: 0.0,
  threeDTrackAltitudeOffsetM: 70,
  threeDRenderStep: 3,
  threeDVarioClassCount: 12,
  threeDMaxVarioForColorMs: 4,
};


export function normalizeFlightSettings(
  value: Partial<FlightSettings> | null | undefined
): FlightSettings {
  return {
    mapTileMode:
      value?.mapTileMode === 'topo' ||
      value?.mapTileMode === 'osm'
        ? value.mapTileMode
        : DEFAULT_FLIGHT_SETTINGS.mapTileMode,

    showAltitudeChart: normalizeBoolean(
      value?.showAltitudeChart,
      DEFAULT_FLIGHT_SETTINGS.showAltitudeChart
    ),

    showVarioChart: normalizeBoolean(
      value?.showVarioChart,
      DEFAULT_FLIGHT_SETTINGS.showVarioChart
    ),

    showSpeedChart: normalizeBoolean(
      value?.showSpeedChart,
      DEFAULT_FLIGHT_SETTINGS.showSpeedChart
    ),

    chartHeightMode:
      value?.chartHeightMode === 'auto' ||
      value?.chartHeightMode === 'compact' ||
      value?.chartHeightMode === 'large'
        ? value.chartHeightMode
        : DEFAULT_FLIGHT_SETTINGS.chartHeightMode,

    altitudeChartResolutionInSec: normalizeNumber(
      value?.altitudeChartResolutionInSec,
      DEFAULT_FLIGHT_SETTINGS.altitudeChartResolutionInSec,
      1,
      60,
      true
    ),

    varioChartResolutionInSec: normalizeNumber(
      value?.varioChartResolutionInSec,
      DEFAULT_FLIGHT_SETTINGS.varioChartResolutionInSec,
      1,
      60,
      true
    ),

    speedChartResolutionInSec: normalizeNumber(
      value?.speedChartResolutionInSec,
      DEFAULT_FLIGHT_SETTINGS.speedChartResolutionInSec,
      1,
      60,
      true
    ),

    trackColorMode:
      value?.trackColorMode === 'vario' ||
      value?.trackColorMode === 'speed'
        ? value.trackColorMode
        : DEFAULT_FLIGHT_SETTINGS.trackColorMode,

    showStatsPanel: normalizeBoolean(
      value?.showStatsPanel,
      DEFAULT_FLIGHT_SETTINGS.showStatsPanel
    ),

    showClimbsOnCharts: normalizeBoolean(
      value?.showClimbsOnCharts,
      DEFAULT_FLIGHT_SETTINGS.showClimbsOnCharts
    ),

    climbDetectionMinGainM: normalizeNumber(
      value?.climbDetectionMinGainM,
      DEFAULT_FLIGHT_SETTINGS.climbDetectionMinGainM,
      1,
      10_000
    ),

    climbDetectionMinSeparationDropM: normalizeNumber(
      value?.climbDetectionMinSeparationDropM,
      DEFAULT_FLIGHT_SETTINGS.climbDetectionMinSeparationDropM,
      0,
      10_000
    ),

    threeDVerticalExaggeration: normalizeNumber(
      value?.threeDVerticalExaggeration,
      DEFAULT_FLIGHT_SETTINGS.threeDVerticalExaggeration,
      0.1,
      10
    ),

    threeDVerticalExaggerationRelativeHeight:
      normalizeNumber(
        value?.threeDVerticalExaggerationRelativeHeight,
        DEFAULT_FLIGHT_SETTINGS
          .threeDVerticalExaggerationRelativeHeight,
        0,
        100_000
      ),

    threeDTrackAltitudeOffsetM: normalizeNumber(
      value?.threeDTrackAltitudeOffsetM,
      DEFAULT_FLIGHT_SETTINGS.threeDTrackAltitudeOffsetM,
      0,
      100_000,
      true
    ),

    threeDRenderStep: normalizeNumber(
      value?.threeDRenderStep,
      DEFAULT_FLIGHT_SETTINGS.threeDRenderStep,
      1,
      1_000,
      true
    ),

    threeDVarioClassCount: normalizeNumber(
      value?.threeDVarioClassCount,
      DEFAULT_FLIGHT_SETTINGS.threeDVarioClassCount,
      2,
      100,
      true
    ),

    threeDMaxVarioForColorMs: normalizeNumber(
      value?.threeDMaxVarioForColorMs,
      DEFAULT_FLIGHT_SETTINGS.threeDMaxVarioForColorMs,
      0.1,
      50
    ),
  };
}

function normalizeBoolean(
  value: unknown,
  fallback: boolean
): boolean {
  return typeof value === 'boolean'
    ? value
    : fallback;
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
  round = false
): number {
  if (
    typeof value !== 'number' ||
    !Number.isFinite(value)
  ) {
    return fallback;
  }

  const normalized = Math.max(
    min,
    Math.min(max, value)
  );

  return round
    ? Math.round(normalized)
    : normalized;
}