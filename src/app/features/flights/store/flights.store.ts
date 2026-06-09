import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';

import { Flight } from '../models/flight.model';
import { FlightSaveService } from '../services/flight-save.service';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';

interface FlightsState {
  flights: Flight[];
  loading: boolean;
  error: string | null;
  lastImportedFlightId: number | null;
}

const initialState: FlightsState = {
  flights: [],
  loading: false,
  error: null,
  lastImportedFlightId: null,
};

export const FlightsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withMethods((store) => {
    const storage = inject(FlightIndexedDbService);
    const flightSaveService = inject(FlightSaveService);

    return {
      /**
       * Loads all flights from local storage.
       */
      async loadFlights(): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          const flights = await storage.getFlights();

          patchState(store, {
            flights,
            loading: false,
          });
        } catch {
          patchState(store, {
            loading: false,
            error: 'Could not load flights.',
          });
        }
      },

      /**
       * Imports one IGC file and reloads the flight list afterwards.
       */
      async importFile(file: File): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
          lastImportedFlightId: null,
        });

        try {
          const result = await flightSaveService.saveFile(file);

          if (result.duplicate) {
            patchState(store, {
              loading: false,
              error: 'This flight was already imported.',
            });
            return;
          }

          const flights = await storage.getFlights();

          patchState(store, {
            flights,
            loading: false,
            lastImportedFlightId: result.flightId,
          });
        } catch {
          patchState(store, {
            loading: false,
            error: 'Could not import flight.',
          });
        }
      },

      /**
       * Deletes one flight and reloads the list afterwards.
       */
      async deleteFlight(flightId: number): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          await storage.deleteFlight(flightId);

          const flights = await storage.getFlights();

          patchState(store, {
            flights,
            loading: false,
          });
        } catch {
          patchState(store, {
            loading: false,
            error: 'Could not delete flight.',
          });
        }
      },

      /**
       * Clears the current error message.
       */
      clearError(): void {
        patchState(store, {
          error: null,
        });
      },
    };
  })
);