// src/app/features/flights/store/flight-settings.store.ts

import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withHooks,
  withMethods,
  withState,
} from '@ngrx/signals';

import {
  ChartHeightMode,
  DEFAULT_FLIGHT_SETTINGS,
  FlightSettings,
  MapTileMode,
  normalizeFlightSettings,
  TrackColorMode,
} from '../models/flight-settings.model';

import { FlightSettingsStorageService } from '../services/flight-settings-storage.service';

export const FlightSettingsStore = signalStore(
  { providedIn: 'root' },

  withState(DEFAULT_FLIGHT_SETTINGS),

  withMethods((store) => {
    const storage = inject(
      FlightSettingsStorageService
    );

    function getCurrentSettings(): FlightSettings {
      return {
        mapTileMode: store.mapTileMode(),

        showAltitudeChart:
          store.showAltitudeChart(),
        showVarioChart:
          store.showVarioChart(),
        showSpeedChart:
          store.showSpeedChart(),

        chartHeightMode:
          store.chartHeightMode(),

        altitudeChartResolutionInSec:
          store.altitudeChartResolutionInSec(),
        varioChartResolutionInSec:
          store.varioChartResolutionInSec(),
        speedChartResolutionInSec:
          store.speedChartResolutionInSec(),

        trackColorMode:
          store.trackColorMode(),

        showStatsPanel:
          store.showStatsPanel(),
        showClimbsOnCharts:
          store.showClimbsOnCharts(),

        climbDetectionMinGainM:
          store.climbDetectionMinGainM(),
        climbDetectionMinSeparationDropM:
          store.climbDetectionMinSeparationDropM(),

        threeDVerticalExaggeration:
          store.threeDVerticalExaggeration(),

        threeDVerticalExaggerationRelativeHeight:
          store
            .threeDVerticalExaggerationRelativeHeight(),

        threeDTrackAltitudeOffsetM:
          store.threeDTrackAltitudeOffsetM(),

        threeDRenderStep:
          store.threeDRenderStep(),

        threeDVarioClassCount:
          store.threeDVarioClassCount(),

        threeDMaxVarioForColorMs:
          store.threeDMaxVarioForColorMs(),
      };
    }

    function updateSettings(
      changes: Partial<FlightSettings>
    ): void {
      const settings = normalizeFlightSettings({
        ...getCurrentSettings(),
        ...changes,
      });

      patchState(store, settings);
      storage.save(settings);
    }

    return {
      setThreeDVisualizationSettings(settings: {
        verticalExaggeration: number;
        verticalExaggerationRelativeHeight: number;
        trackAltitudeOffsetM: number;
        renderStep: number;
        varioClassCount: number;
        maxVarioForColorMs: number;
      }): void {
        updateSettings({
          threeDVerticalExaggeration:
            settings.verticalExaggeration,

          threeDVerticalExaggerationRelativeHeight:
            settings.verticalExaggerationRelativeHeight,

          threeDTrackAltitudeOffsetM:
            settings.trackAltitudeOffsetM,

          threeDRenderStep:
            settings.renderStep,

          threeDVarioClassCount:
            settings.varioClassCount,

          threeDMaxVarioForColorMs:
            settings.maxVarioForColorMs,
        });
      },

      setClimbDetectionSettings(
        minGainM: number,
        minSeparationDropM: number
      ): void {
        updateSettings({
          climbDetectionMinGainM: minGainM,
          climbDetectionMinSeparationDropM:
            minSeparationDropM,
        });
      },

      setShowStatsPanel(show: boolean): void {
        updateSettings({
          showStatsPanel: show,
        });
      },

      setShowClimbsOnCharts(show: boolean): void {
        updateSettings({
          showClimbsOnCharts: show,
        });
      },

      setMapTileMode(
        mapTileMode: MapTileMode
      ): void {
        updateSettings({
          mapTileMode,
        });
      },

      setTrackColorMode(
        trackColorMode: TrackColorMode
      ): void {
        updateSettings({
          trackColorMode,
        });
      },

      setChartHeightMode(
        chartHeightMode: ChartHeightMode
      ): void {
        updateSettings({
          chartHeightMode,
        });
      },

      setShowAltitudeChart(
        show: boolean
      ): void {
        updateSettings({
          showAltitudeChart: show,
        });
      },

      setShowVarioChart(
        show: boolean
      ): void {
        updateSettings({
          showVarioChart: show,
        });
      },

      setShowSpeedChart(
        show: boolean
      ): void {
        updateSettings({
          showSpeedChart: show,
        });
      },

      setAltitudeChartResolutionInSec(
        value: number
      ): void {
        updateSettings({
          altitudeChartResolutionInSec: value,
        });
      },

      setVarioChartResolutionInSec(
        value: number
      ): void {
        updateSettings({
          varioChartResolutionInSec: value,
        });
      },

      setSpeedChartResolutionInSec(
        value: number
      ): void {
        updateSettings({
          speedChartResolutionInSec: value,
        });
      },

      resetSettings(): void {
        storage.reset();
        patchState(
          store,
          DEFAULT_FLIGHT_SETTINGS
        );
      },
    };
  }),

  withHooks({
    onInit(store): void {
      const storage = inject(
        FlightSettingsStorageService
      );

      patchState(store, storage.load());
    },
  })
);

