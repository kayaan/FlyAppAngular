import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';

import { Flight } from '../models/flight.model';
import { TrackArrays } from '../models/track-arrays.model';
import { Climb } from '../models/climb.model';
import { FlightStats } from '../models/flight-stats.model';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { DerivedFlightStatsService } from '../services/derived-flight-stats.service';
import { StatsSelection } from '../models/derived-flight-stats.model';
import { FlightSettingsStore } from './flight-settings.store';
import { TrackColorService } from '../services/track-color.service';

type FlightDetailsState = {
  flight: Flight | null;
  track: TrackArrays | null;
  climbs: Climb[];
  stats: FlightStats[];

  selectedClimbId: number | null;
  selectedRange: {
    startIndex: number;
    endIndex: number;
  } | null;

  cursorIndex: number | null;

  loading: boolean;
  error: string | null;
};

const initialState: FlightDetailsState = {
  flight: null,
  track: null,
  climbs: [],
  stats: [],

  selectedClimbId: null,
  selectedRange: null,

  cursorIndex: null,

  loading: false,
  error: null,
};

export const FlightDetailsStore = signalStore(
  withState(initialState),

  withComputed((store) => {
    const derivedStatsService = inject(DerivedFlightStatsService);

    return {
      derivedStats: computed(() => {
        const selectedRange = store.selectedRange();
        const selectedClimbId = store.selectedClimbId();

        const selection: StatsSelection =
          selectedRange !== null
            ? {
              type: 'range',
              startIndex: selectedRange.startIndex,
              endIndex: selectedRange.endIndex,
            }
            : selectedClimbId !== null
              ? {
                type: 'climb',
                climbId: selectedClimbId,
              }
              : {
                type: 'flight',
              };

        return derivedStatsService.derive(
          store.track(),
          store.climbs(),
          selection
        );
      }),
    };
  }),
  
  withComputed((store) => {
    const settings = inject(FlightSettingsStore);
    const trackColorService = inject(TrackColorService);

    return {
      coloredTrackSegments: computed(() =>
        trackColorService.buildVarioColoredSegments(
          store.track(),
          settings.varioChartResolutionInSec(),
        ),
      ),
    };
  }),

  withMethods((store) => {
    const storage = inject(FlightIndexedDbService);

    return {
      setCursorIndex(index: number | null): void {
        patchState(store, {
          cursorIndex: index,
        });
      },

      selectClimb(climbId: number): void {
        patchState(store, {
          selectedClimbId: climbId,
          selectedRange: null,
          cursorIndex: null,
        });
      },

      selectRange(startIndex: number, endIndex: number): void {
        patchState(store, {
          selectedClimbId: null,
          selectedRange: {
            startIndex: Math.min(startIndex, endIndex),
            endIndex: Math.max(startIndex, endIndex),
          },
          cursorIndex: null,
        });
      },

      clearSelection(): void {
        patchState(store, {
          selectedClimbId: null,
          selectedRange: null,
          cursorIndex: null,
        });
      },

      /**
       * Loads one flight with track, climbs and stats.
       */
      async loadFlight(flightId: number): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
          selectedClimbId: null,
          selectedRange: null,
          cursorIndex: null,
        });

        try {
          const details = await storage.getFlightDetails(flightId);

          if (!details) {
            patchState(store, {
              flight: null,
              track: null,
              climbs: [],
              stats: [],
              selectedClimbId: null,
              selectedRange: null,
              cursorIndex: null,
              loading: false,
              error: 'Flight not found.',
            });

            return;
          }

          patchState(store, {
            flight: details.flight,
            track: details.track ?? null,
            climbs: details.climbs,
            stats: details.stats,
            selectedClimbId: null,
            selectedRange: null,
            cursorIndex: null,
            loading: false,
            error: null,
          });
        } catch {
          patchState(store, {
            flight: null,
            track: null,
            climbs: [],
            stats: [],
            selectedClimbId: null,
            selectedRange: null,
            cursorIndex: null,
            loading: false,
            error: 'Could not load flight details.',
          });
        }
      },

      /**
       * Clears the loaded details.
       */
      clear(): void {
        patchState(store, initialState);
      },

      /**
       * Clears the current error.
       */
      clearError(): void {
        patchState(store, {
          error: null,
        });
      },
    };
  }),


);