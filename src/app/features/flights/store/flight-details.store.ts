import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { AppErrorService } from '../../../core/errors/app-error.service';

import { Flight } from '../models/flight.model';
import { TrackArrays } from '../models/track-arrays.model';
import { Climb } from '../models/climb.model';
import { FlightStats } from '../models/flight-stats.model';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { DerivedFlightStatsService } from '../domain/derived-flight-stats.service';
import { StatsSelection } from '../models/derived-flight-stats.model';
import { FlightSettingsStore } from './flight-settings.store';
import { TrackColorService } from '../services/track-color.service';
import { ClimbDetectorService } from '../domain/climb-detector.service';
import { DetectedClimb } from '../models/detected-climb.model';
import { ReplayRange, ReplayState } from '../models/replay-state.model';
import { TrackMetrics } from '../models/track-metrics.model';
import { TrackMetricsService } from '../domain/track-metrics.service';
import { PublicFlightsApiService } from '../services/public-flights-api.service';

type FlightDetailsState = {
  flight: Flight | null;
  track: TrackArrays | null;
  trackMetrics: TrackMetrics | null;
  climbs: Climb[];
  stats: FlightStats | null;

  selectedClimbId: number | null;
  selectedRange: {
    startIndex: number;
    endIndex: number;
  } | null;

  cursorIndex: number | null;

  loading: boolean;
  error: string | null;

  zoomToSelectedClimbRequest: number;
  resetChartZoomRequest: number;

  showOnlySelectedClimbTrack: boolean;
  replay: ReplayState;
};

const initialState: FlightDetailsState = {
  flight: null,
  track: null,
  trackMetrics: null,
  climbs: [],
  stats: null,

  selectedClimbId: null,
  selectedRange: null,

  cursorIndex: null,

  loading: false,
  error: null,

  zoomToSelectedClimbRequest: 0,
  resetChartZoomRequest: 0,

  showOnlySelectedClimbTrack: false,

  replay: {
    active: false,
    paused: false,
    index: null,
    speed: 1,
    direction: 1,
    cameraFollowEnabled: false,
    range: null,
    replayTrailDurationSec: null,
  },
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
    const errorService = inject(AppErrorService);
    const trackColorService = inject(TrackColorService);

    return {
      coloredTrackSegments: computed(() => {
        if (settings.trackColorMode() === 'speed') {
          return trackColorService.buildSpeedColoredSegments(
            store.track(),
            settings.speedChartResolutionInSec()
          );
        }

        return trackColorService.buildVarioColoredSegments(
          store.track(),
          settings.varioChartResolutionInSec()
        );
      }),
    };
  }),

  withMethods((store) => {
    const storage = inject(FlightIndexedDbService);
    const publicFlightsApi = inject(PublicFlightsApiService);
    const climbDetector = inject(ClimbDetectorService);
    const trackMetricsService = inject(TrackMetricsService);
    const settings = inject(FlightSettingsStore);
    const errorService = inject(AppErrorService);

    function resetBeforeLoad(): void {
      patchState(store, {
        loading: true,
        error: null,
        selectedClimbId: null,
        selectedRange: null,
        cursorIndex: null,
        trackMetrics: null,
        resetChartZoomRequest: store.resetChartZoomRequest() + 1,
        replay: {
          active: false,
          paused: false,
          index: null,
          speed: 1,
          direction: 1,
          cameraFollowEnabled: false,
          range: null,
          replayTrailDurationSec: null,
        },
      });
    }

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

      const replay = store.replay();
      const track = store.track();

      if (replay.active && track) {
        patchState(store, {
          selectedClimbId: climb.id,
          selectedRange: null,
          cursorIndex: null,
          replay: {
            ...replay,
            index: climb.startIndex,
            range: {
              startIndex: climb.startIndex,
              endIndex: climb.endIndex,
            },
          },
        });

        return;
      }

      patchState(store, {
        selectedClimbId: climb.id,
        selectedRange: null,
        cursorIndex: null,
      });
    }

    function calculateClimbs(
      track: TrackArrays | null,
      flightId: string
    ): Climb[] {
      if (!track) {
        return [];
      }

      return climbDetector
        .detectClimbs(track, {
          minGainM: settings.climbDetectionMinGainM(),
          minSeparationDropM: settings.climbDetectionMinSeparationDropM(),
        })
        .map((climb: DetectedClimb, index): Climb => ({
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
        }));
    }

    function calculateTrackMetrics(
      track: TrackArrays | null
    ): TrackMetrics | null {
      if (!track) {
        return null;
      }

      return trackMetricsService.build(
        track,
        settings.altitudeChartResolutionInSec(),
        settings.varioChartResolutionInSec(),
        settings.speedChartResolutionInSec()
      );
    }

    function resolveReplayRange(
      track: TrackArrays | null,
      climbs: Climb[],
      selectedClimbId: number | null,
      selectedRange: { startIndex: number; endIndex: number } | null
    ): ReplayRange | null {
      if (!track || track.timeSec.length === 0) {
        return null;
      }

      const lastIndex = track.timeSec.length - 1;

      if (selectedClimbId !== null) {
        const climb = climbs.find((item) => item.id === selectedClimbId);

        if (climb) {
          return {
            startIndex: Math.max(0, Math.min(climb.startIndex, climb.endIndex)),
            endIndex: Math.min(
              lastIndex,
              Math.max(climb.startIndex, climb.endIndex)
            ),
          };
        }
      }

      if (selectedRange) {
        return {
          startIndex: Math.max(
            0,
            Math.min(selectedRange.startIndex, selectedRange.endIndex)
          ),
          endIndex: Math.min(
            lastIndex,
            Math.max(selectedRange.startIndex, selectedRange.endIndex)
          ),
        };
      }

      return null;
    }

    return {
      setReplayTrailDurationSec(durationSec: number | null): void {
        patchState(store, (state) => ({
          replay: {
            ...state.replay,
            replayTrailDurationSec:
              durationSec !== null ? Math.max(1, Math.round(durationSec)) : null,
          },
        }));
      },

      setReplayCameraFollowEnabled(enabled: boolean): void {
        patchState(store, (state) => ({
          replay: {
            ...state.replay,
            cameraFollowEnabled: enabled,
          },
        }));
      },

      recalculateTrackMetrics(): void {
        patchState(store, {
          trackMetrics: calculateTrackMetrics(store.track()),
        });
      },

      setShowOnlySelectedClimbIn3d(value: boolean): void {
        patchState(store, { showOnlySelectedClimbTrack: value });
      },

      zoomToSelectedClimb(): void {
        patchState(store, {
          zoomToSelectedClimbRequest: store.zoomToSelectedClimbRequest() + 1,
        });
      },

      requestResetChartZoom(): void {
        patchState(store, {
          resetChartZoomRequest: store.resetChartZoomRequest() + 1,
        });
      },

      setCursorIndex(index: number | null): void {
        patchState(store, {
          cursorIndex: index,
        });
      },

      selectClimb(climbId: number): void {
        const climb = store.climbs().find((item) => item.id === climbId);

        patchState(store, {
          selectedClimbId: climbId,
          selectedRange: null,
          cursorIndex: null,
        });

        if (!climb) {
          return;
        }

        const replay = store.replay();

        if (!replay.active) {
          return;
        }

        patchState(store, {
          replay: {
            ...replay,
            index: climb.startIndex,
            range: {
              startIndex: climb.startIndex,
              endIndex: climb.endIndex,
            },
          },
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
          resetChartZoomRequest: store.resetChartZoomRequest() + 1,
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
          resetChartZoomRequest: store.resetChartZoomRequest() + 1,
        });
      },

      playReplayForward(): void {
        const track = store.track();

        if (!track || track.timeSec.length === 0) {
          return;
        }

        const range = resolveReplayRange(
          track,
          store.climbs(),
          store.selectedClimbId(),
          store.selectedRange()
        );

        const lastIndex = track.timeSec.length - 1;
        const startIndex = range?.startIndex ?? 0;
        const endIndex = range?.endIndex ?? lastIndex;

        const currentIndex = store.replay().index;

        patchState(store, (state) => ({
          replay: {
            ...state.replay,
            active: true,
            paused: false,
            direction: 1 as const,
            index:
              currentIndex !== null &&
                currentIndex >= startIndex &&
                currentIndex <= endIndex
                ? currentIndex
                : startIndex,
            range,
          },
        }));
      },

      playReplayBackward(): void {
        const track = store.track();

        if (!track || track.timeSec.length === 0) {
          return;
        }

        const range = resolveReplayRange(
          track,
          store.climbs(),
          store.selectedClimbId(),
          store.selectedRange()
        );

        const lastIndex = track.timeSec.length - 1;
        const startIndex = range?.startIndex ?? 0;
        const endIndex = range?.endIndex ?? lastIndex;

        const currentIndex = store.replay().index;

        patchState(store, (state) => ({
          replay: {
            ...state.replay,
            active: true,
            paused: false,
            direction: -1 as const,
            index:
              currentIndex !== null &&
                currentIndex >= startIndex &&
                currentIndex <= endIndex
                ? currentIndex
                : endIndex,
            range,
          },
        }));
      },

      async loadFlight(flightId: string): Promise<void> {
        resetBeforeLoad();

        try {
          const details = await storage.getFlightDetails(flightId);

          if (!details) {
            patchState(store, {
              flight: null,
              track: null,
              trackMetrics: null,
              climbs: [],
              stats: null,
              selectedClimbId: null,
              selectedRange: null,
              cursorIndex: null,
              loading: false,
              error: 'Flight not found.',
              resetChartZoomRequest: store.resetChartZoomRequest() + 1,
              showOnlySelectedClimbTrack: false,
            });

            return;
          }

          const track = details.track ?? null;
          const climbs = calculateClimbs(track, details.flight.id);
          const trackMetrics = calculateTrackMetrics(track);

          patchState(store, {
            flight: details.flight,
            track,
            trackMetrics,
            climbs,
            stats: details.stats ?? null,
            selectedClimbId: null,
            selectedRange: null,
            cursorIndex: null,
            loading: false,
            error: null,
            resetChartZoomRequest: store.resetChartZoomRequest() + 1,
            showOnlySelectedClimbTrack: false,
          });
        } catch (error) {
          patchState(store, {
            flight: null,
            track: null,
            trackMetrics: null,
            climbs: [],
            stats: null,
            selectedClimbId: null,
            selectedRange: null,
            cursorIndex: null,
            loading: false,
            error: errorService.getMessage(
              error,
              'Could not load flight details.'
            ),
            resetChartZoomRequest: store.resetChartZoomRequest() + 1,
            showOnlySelectedClimbTrack: false,
          });
        }
      },

      async loadPublicFlight(flightId: string): Promise<void> {
        resetBeforeLoad();

        try {
          const dto = await firstValueFrom(
            publicFlightsApi.getPublicFlightDetails(flightId)
          );

          const flight: Flight = {
            id: dto.flight.id,
            fileName: dto.flight.fileName,
            flightDate: dto.flight.flightDate,
            pilot: dto.flight.pilot,
            glider: dto.flight.glider,
            importedAtUtc: dto.flight.importedAtUtc,
          };

          const track: TrackArrays = {
            timeSec: new Int32Array(dto.track.timeSec),
            latE7: new Int32Array(dto.track.latE7),
            lonE7: new Int32Array(dto.track.lonE7),
            altGpsCm: new Int32Array(dto.track.altGpsCm),
            altBaroCm: new Int32Array(dto.track.altBaroCm),
          };

          const stats: FlightStats = {
            id: dto.flight.id,

            startIndex: dto.flight.startIndex,
            endIndex: dto.flight.endIndex,
            fixCount: dto.flight.fixCount,

            startTimeSec: dto.flight.startTimeSec,
            endTimeSec: dto.flight.endTimeSec,
            durationSec: dto.flight.durationSec,

            distanceM: dto.flight.distanceM,

            minAltGpsM: dto.flight.minAltGpsM,
            maxAltGpsM: dto.flight.maxAltGpsM,
            gainGpsM: dto.flight.gainGpsM,

            minAltBaroM: dto.flight.minAltBaroM,
            maxAltBaroM: dto.flight.maxAltBaroM,
            gainBaroM: dto.flight.gainBaroM,
          };

          const climbs = calculateClimbs(track, flight.id);
          const trackMetrics = calculateTrackMetrics(track);

          patchState(store, {
            flight,
            track,
            trackMetrics,
            climbs,
            stats,
            selectedClimbId: null,
            selectedRange: null,
            cursorIndex: null,
            loading: false,
            error: null,
            resetChartZoomRequest: store.resetChartZoomRequest() + 1,
            showOnlySelectedClimbTrack: false,
          });
        } catch (error) {
          const message = errorService.isNotFound(error)
            ? 'The public flight no longer exists or is not public.'
            : errorService.getMessage(
                error,
                'Could not load public flight details.'
              );

          patchState(store, {
            flight: null,
            track: null,
            trackMetrics: null,
            climbs: [],
            stats: null,
            selectedClimbId: null,
            selectedRange: null,
            cursorIndex: null,
            loading: false,
            error: message,
            resetChartZoomRequest: store.resetChartZoomRequest() + 1,
            showOnlySelectedClimbTrack: false,
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

      startReplay(): void {
        const track = store.track();

        if (!track || track.timeSec.length === 0) {
          return;
        }

        patchState(store, {
          replay: {
            ...store.replay(),
            active: true,
            paused: false,
            index: store.replay().index ?? 0,
          },
        });
      },

      pauseReplay(): void {
        patchState(store, {
          replay: {
            ...store.replay(),
            paused: true,
            active: true,
          },
        });
      },

      resumeReplay(): void {
        patchState(store, {
          replay: {
            ...store.replay(),
            active: true,
            paused: false,
          },
        });
      },

      stopReplay(): void {
        patchState(store, {
          cursorIndex: null,
          replay: {
            ...store.replay(),
            active: false,
            paused: false,
            index: null,
            range: null,
          },
        });
      },

      setReplayIndex(index: number): void {
        const track = store.track();

        if (!track || track.timeSec.length === 0) {
          return;
        }

        const maxIndex = track.timeSec.length - 1;
        const safeIndex = Math.max(0, Math.min(index, maxIndex));

        patchState(store, {
          replay: {
            ...store.replay(),
            index: safeIndex,
          },
        });
      },

      setReplaySpeed(speed: number): void {
        patchState(store, {
          replay: {
            ...store.replay(),
            speed,
          },
        });
      },
    };
  })
);