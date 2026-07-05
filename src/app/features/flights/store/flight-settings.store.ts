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
  DEFAULT_FLIGHT_SETTINGS,
  ChartHeightMode,
  MapTileMode,
  TrackColorMode,
} from '../models/flight-settings.model';
import { FlightSettingsStorageService } from '../services/flight-settings-storage.service';

export const FlightSettingsStore = signalStore(
  { providedIn: 'root' },

  withState(DEFAULT_FLIGHT_SETTINGS),

  withMethods((store) => {
    const storage = inject(FlightSettingsStorageService);

    function normalizeResolution(value: number): number {
      if (!Number.isFinite(value)) {
        return 1;
      }

      return Math.max(1, Math.min(60, Math.round(value)));
    }

    function persist(): void {
      storage.save({
        mapTileMode: store.mapTileMode(),

        showAltitudeChart: store.showAltitudeChart(),
        showVarioChart: store.showVarioChart(),
        showSpeedChart: store.showSpeedChart(),

        chartHeightMode: store.chartHeightMode(),

        altitudeChartResolutionInSec: store.altitudeChartResolutionInSec(),
        varioChartResolutionInSec: store.varioChartResolutionInSec(),
        speedChartResolutionInSec: store.speedChartResolutionInSec(),

        trackColorMode: store.trackColorMode(),

        showStatsPanel: store.showStatsPanel(),
        showClimbsOnCharts: store.showClimbsOnCharts(),
      });
    }

    return {

      setShowStatsPanel(show: boolean): void {
        patchState(store, {
          showStatsPanel: show,
        });

        persist();
      },

      setShowClimbsOnCharts(show: boolean): void {
        patchState(store, {
          showClimbsOnCharts: show,
        });

        persist();
      },

      setMapTileMode(mapTileMode: MapTileMode): void {
        patchState(store, {
          mapTileMode,
        });

        persist();
      },

      setTrackColorMode(trackColorMode: TrackColorMode): void {
        patchState(store, {
          trackColorMode,
        });

        persist();
      },

      setChartHeightMode(chartHeightMode: ChartHeightMode): void {
        patchState(store, {
          chartHeightMode,
        });

        persist();
      },

      setShowAltitudeChart(show: boolean): void {
        patchState(store, {
          showAltitudeChart: show,
        });

        persist();
      },

      setShowVarioChart(show: boolean): void {
        patchState(store, {
          showVarioChart: show,
        });

        persist();
      },

      setShowSpeedChart(show: boolean): void {
        patchState(store, {
          showSpeedChart: show,
        });

        persist();
      },

      setAltitudeChartResolutionInSec(value: number): void {
        patchState(store, {
          altitudeChartResolutionInSec: normalizeResolution(value),
        });

        persist();
      },

      setVarioChartResolutionInSec(value: number): void {
        patchState(store, {
          varioChartResolutionInSec: normalizeResolution(value),
        });

        persist();
      },

      setSpeedChartResolutionInSec(value: number): void {
        patchState(store, {
          speedChartResolutionInSec: normalizeResolution(value),
        });

        persist();
      },

      resetSettings(): void {
        storage.reset();

        patchState(store, DEFAULT_FLIGHT_SETTINGS);
      },
    };
  }),

  withHooks({
    onInit(store): void {
      const storage = inject(FlightSettingsStorageService);

      patchState(store, {
        ...DEFAULT_FLIGHT_SETTINGS,
        ...storage.load(),
      });
    },
  })
);