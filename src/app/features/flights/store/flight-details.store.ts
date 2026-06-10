import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';

import { Flight } from '../models/flight.model';
import { TrackArrays } from '../models/track-arrays.model';
import { Climb } from '../models/climb.model';
import { FlightStats } from '../models/flight-stats.model';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';

type FlightDetailsState = {
  flight: Flight | null;
  track: TrackArrays | null;
  climbs: Climb[];
  stats: FlightStats[];

  cursorIndex: number | null;

  loading: boolean;
  error: string | null;
};

const initialState: FlightDetailsState = {
  flight: null,
  track: null,
  climbs: [],
  stats: [],

  cursorIndex: null,

  loading: false,
  error: null,
};

export const FlightDetailsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store) => {
    const storage = inject(FlightIndexedDbService);

    return {

      setCursorIndex(index: number | null): void {
        patchState(store, {
          cursorIndex: index,
        });
      },

      /**
       * Loads one flight with track, climbs and stats.
       */
      async loadFlight(flightId: number): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          const details = await storage.getFlightDetails(flightId);

          if (!details) {
            patchState(store, {
              flight: null,
              track: null,
              climbs: [],
              stats: [],
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
            loading: false,
            error: null,
          });
        } catch {
          patchState(store, {
            flight: null,
            track: null,
            climbs: [],
            stats: [],
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
  })
);