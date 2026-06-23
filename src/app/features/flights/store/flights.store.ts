import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { BackendFlight } from '../models/backend-flight.model';
import { FlightSaveService } from '../services/flight-save.service';
import { FlightListMergeService } from '../services/flight-list-merge.service';
import { BackendFlightsApiService } from '../services/backend-flights-api.service';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { LocalFlightListItem } from '../data-access/flight-storage.interface';
import { Flight } from '../models/flight.model';
import { ImportBackendFlightRequest } from '../models/backend-flight-import.model';
import { FlightStats } from '../models/flight-stats.model';

type FlightsState = {
  localFlightListItems: LocalFlightListItem[];
  backendFlights: BackendFlight[];

  loading: boolean;
  error: string | null;
  lastImportedFlightId: string | null;

  backendFlightsLoading: boolean;
  backendFlightsError: string | null;
};

const initialState: FlightsState = {
  localFlightListItems: [],
  backendFlights: [],

  loading: false,
  error: null,
  lastImportedFlightId: null,

  backendFlightsLoading: false,
  backendFlightsError: null,
};

export const FlightsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => {
    const mergeService = inject(FlightListMergeService);

    return {
      flightListItems: computed(() =>
        mergeService.merge(store.localFlightListItems(), store.backendFlights())
      ),
    };
  }),

  withMethods((store) => {
    const storage = inject(FlightIndexedDbService);
    const flightSaveService = inject(FlightSaveService);
    const backendFlightsApi = inject(BackendFlightsApiService);

    return {
      async loadFlights(): Promise<void> {
        patchState(store, {
          loading: true,
          backendFlightsLoading: true,
          error: null,
          backendFlightsError: null,
        });

        try {
          const localFlightListItems = await storage.getFlightListItems();

          console.error(localFlightListItems)


          patchState(store, {
            localFlightListItems,
            loading: false,
          });
        } catch {
          patchState(store, {
            localFlightListItems: [],
            loading: false,
            error: 'Could not load local flights.',
          });
        }

        try {
          const backendFlights = await firstValueFrom(
            backendFlightsApi.getFlights()
          );

          patchState(store, {
            backendFlights,
            backendFlightsLoading: false,
            backendFlightsError: null,
          });
        } catch {
          patchState(store, {
            backendFlights: [],
            backendFlightsLoading: false,
            backendFlightsError: null,
          });
        }
      },

      async loadLocalFlights(): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          const localFlightListItems = await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            loading: false,
          });
        } catch {
          patchState(store, {
            localFlightListItems: [],
            loading: false,
            error: 'Could not load local flights.',
          });
        }
      },

      async importFile(file: File): Promise<void> {
        await this.importFiles([file]);
      },

      async importFiles(files: FileList | File[]): Promise<void> {
        const fileArray = Array.from(files);

        if (fileArray.length === 0) {
          return;
        }

        patchState(store, {
          loading: true,
          error: null,
          lastImportedFlightId: null,
        });

        try {
          let lastImportedFlightId: string | null = null;
          let duplicateCount = 0;

          for (const file of fileArray) {
            const result = await flightSaveService.saveFile(file);

            if (result.duplicate) {
              duplicateCount++;
              continue;
            }

            lastImportedFlightId = result.flightId;
          }

          const localFlightListItems = await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            loading: false,
            lastImportedFlightId,
            error:
              duplicateCount > 0
                ? `${duplicateCount} file(s) were already imported.`
                : null,
          });
        } catch {
          patchState(store, {
            loading: false,
            error: 'Could not import flights.',
          });
        }
      },

      async deleteFlight(flightId: string): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          await storage.deleteFlight(flightId);

          const localFlightListItems = await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            loading: false,
          });
        } catch {
          patchState(store, {
            loading: false,
            error: 'Could not delete flight.',
          });
        }
      },

      async loadBackendFlights(): Promise<void> {
        patchState(store, {
          backendFlightsLoading: true,
          backendFlightsError: null,
        });

        try {
          const backendFlights = await firstValueFrom(
            backendFlightsApi.getFlights()
          );

          patchState(store, {
            backendFlights,
            backendFlightsLoading: false,
            backendFlightsError: null,
          });
        } catch {
          patchState(store, {
            backendFlights: [],
            backendFlightsLoading: false,
            backendFlightsError: null,
          });
        }
      },

      async syncFlightToBackend(file: File, localFlight: Flight): Promise<void> {
        const details = await storage.getFlightDetails(localFlight.id);
        const backendStats = toBackendImportStats(details?.stats);

        const request: ImportBackendFlightRequest = {
          id: localFlight.id,
          fileName: localFlight.fileName,
          flightDate: localFlight.flightDate ?? null,
          pilot: localFlight.pilot ?? null,
          glider: localFlight.glider ?? null,
          importedAtUtc: localFlight.importedAtUtc,
          stats: backendStats,
        };

        await firstValueFrom(
          backendFlightsApi.importFlight(request, file)
        );

        await this.loadBackendFlights();
      },

      clearError(): void {
        patchState(store, {
          error: null,
        });
      },

      clearBackendFlightsError(): void {
        patchState(store, {
          backendFlightsError: null,
        });
      },
    };
  }),


);

function toBackendImportStats(stats: FlightStats | null | undefined): FlightStats | null {
  if (!stats) {
    return null;
  }

  return {
    id: stats.id,

    startIndex: stats.startIndex,
    endIndex: stats.endIndex,
    fixCount: stats.fixCount,

    startTimeSec: stats.startTimeSec,
    endTimeSec: stats.endTimeSec,
    durationSec: stats.durationSec,

    distanceM: stats.distanceM,

    minAltGpsM: stats.minAltGpsM,
    maxAltGpsM: stats.maxAltGpsM,
    gainGpsM: stats.gainGpsM,

    minAltBaroM: stats.minAltBaroM,
    maxAltBaroM: stats.maxAltBaroM,
    gainBaroM: stats.gainBaroM,
  };
}