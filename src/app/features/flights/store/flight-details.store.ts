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
import { ClimbDetectorService } from '../services/climb-detector.service';
import { DetectedClimb } from '../models/detected-climb.model';

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

  zoomToSelectedClimbRequest: number
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

  zoomToSelectedClimbRequest: 0,
};

export const FlightDetailsStore = signalStore(
  withState(initialState),

  withComputed((store) => {
    const derivedStatsService = inject(DerivedFlightStatsService);

    return {
      climbCount: computed(() => store.climbs().length),

      selectedClimbIndex: computed(() => {
        const selectedClimbId = store.selectedClimbId();

        if (selectedClimbId === null) {
          return -1;
        }

        return store.climbs().findIndex((climb) => climb.id === selectedClimbId);
      }),

      selectedClimb: computed(() => {
        const selectedClimbId = store.selectedClimbId();

        if (selectedClimbId === null) {
          return null;
        }

        return (
          store.climbs().find((climb) => climb.id === selectedClimbId) ?? null
        );
      }),

      selectedClimbNumber: computed(() => {
        const selectedClimbId = store.selectedClimbId();

        if (selectedClimbId === null) {
          return null;
        }

        const index = store
          .climbs()
          .findIndex((climb) => climb.id === selectedClimbId);

        return index >= 0 ? index + 1 : null;
      }),

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
          settings.varioChartResolutionInSec()
        )
      ),
    };
  }),

  withMethods((store) => {
    const storage = inject(FlightIndexedDbService);
    const climbDetector = inject(ClimbDetectorService);

    function selectClimbByIndex(index: number): void {
      const climbs = store.climbs();

      if (climbs.length === 0) {
        patchState(store, {
          selectedClimbId: null,
          selectedRange: null,
          cursorIndex: null,
        });

        return;
      }

      const safeIndex = Math.max(0, Math.min(index, climbs.length - 1));
      const climb = climbs[safeIndex];

      patchState(store, {
        selectedClimbId: climb.id,
        selectedRange: null,
        cursorIndex: null,
      });
    }

    function calculateClimbs(track: TrackArrays | null, flightId: number): Climb[] {
      if (!track) {
        return [];
      }

      return climbDetector.detectClimbs(track).map(
        (climb: DetectedClimb, index): Climb => ({
          id: index + 1,
          flightId,

          startIndex: climb.startIndex,
          endIndex: climb.endIndex,
          peakIndex: climb.peakIndex,

          startTimeSec: climb.startTimeSec,
          endTimeSec: climb.endTimeSec,
          durationSec: climb.durationSec,

          gainM: climb.gainM,
          avgClimbMs: climb.avgClimbMs,
          maxClimbMs: climb.maxClimbMs,
        })
      );
    }

    return {
      zoomToSelectedClimb(): void {
        patchState(store, (state) => ({
          zoomToSelectedClimbRequest: state.zoomToSelectedClimbRequest + 1,
        }));
      },
      
      setCursorIndex(index: number | null): void {
        patchState(store, {
          cursorIndex: index,
        });
      },

      selectClimb(climbId: number): void {
        const exists = store.climbs().some((climb) => climb.id === climbId);

        if (!exists) {
          return;
        }

        patchState(store, {
          selectedClimbId: climbId,
          selectedRange: null,
          cursorIndex: null,
        });
      },

      selectNextClimb(): void {
        const climbs = store.climbs();

        if (climbs.length === 0) {
          return;
        }

        const selectedClimbId = store.selectedClimbId();

        if (selectedClimbId === null) {
          selectClimbByIndex(0);
          return;
        }

        const currentIndex = climbs.findIndex(
          (climb) => climb.id === selectedClimbId
        );

        const nextIndex =
          currentIndex < 0 || currentIndex >= climbs.length - 1
            ? 0
            : currentIndex + 1;

        selectClimbByIndex(nextIndex);
      },

      selectPreviousClimb(): void {
        const climbs = store.climbs();

        if (climbs.length === 0) {
          return;
        }

        const selectedClimbId = store.selectedClimbId();

        if (selectedClimbId === null) {
          selectClimbByIndex(climbs.length - 1);
          return;
        }

        const currentIndex = climbs.findIndex(
          (climb) => climb.id === selectedClimbId
        );

        const previousIndex =
          currentIndex <= 0 ? climbs.length - 1 : currentIndex - 1;

        selectClimbByIndex(previousIndex);
      },

      clearSelectedClimb(): void {
        patchState(store, {
          selectedClimbId: null,
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

          const track = details.track ?? null;
          const climbs = calculateClimbs(track, details.flight.id);

          patchState(store, {
            flight: details.flight,
            track,
            climbs,
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

      clear(): void {
        patchState(store, initialState);
      },

      clearError(): void {
        patchState(store, {
          error: null,
        });
      },
    };
  })
);