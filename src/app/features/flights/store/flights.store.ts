import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { LocalFlightListItem } from '../data-access/flight-storage.interface';
import { BackendFlight } from '../models/backend-flight.model';
import { BackendFlightsApiService } from '../services/backend-flights-api.service';
import { FlightBackendSyncService } from '../services/flight-backend-sync.service';
import { FlightListMergeService } from '../services/flight-list-merge.service';
import { FlightSaveService } from '../services/flight-save.service';

type FlightsState = {
  localFlightListItems: LocalFlightListItem[];
  backendFlights: BackendFlight[];

  loading: boolean;
  error: string | null;
  lastImportedFlightId: string | null;

  backendFlightsLoading: boolean;
  backendFlightsError: string | null;

  uploadingFlightId: string | null;
  downloadingFlightId: string | null;
  syncErrorByFlightId: Record<string, string>;

};

const initialState: FlightsState = {
  localFlightListItems: [],
  backendFlights: [],

  loading: false,
  error: null,
  lastImportedFlightId: null,

  backendFlightsLoading: false,
  backendFlightsError: null,

  uploadingFlightId: null,
  downloadingFlightId: null,
  syncErrorByFlightId: {},
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
    const backendSync = inject(FlightBackendSyncService);

    function clearSyncError(flightId: string): void {
      const current = store.syncErrorByFlightId();
      const { [flightId]: _, ...rest } = current;

      patchState(store, {
        syncErrorByFlightId: rest,
      });
    }

    function setSyncError(flightId: string, message: string): void {
      patchState(store, {
        syncErrorByFlightId: {
          ...store.syncErrorByFlightId(),
          [flightId]: message,
        },
      });
    }

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

      async syncUploadFlight(flightId: string): Promise<void> {
        patchState(store, {
          uploadingFlightId: flightId,
        });

        clearSyncError(flightId);

        try {
          await backendSync.uploadFlight(flightId);

          await this.loadBackendFlights();

          patchState(store, {
            uploadingFlightId: null,
          });
        } catch (error) {
          console.error('Failed to upload flight to backend', error);

          setSyncError(flightId, 'Upload failed.');

          patchState(store, {
            uploadingFlightId: null,
          });
        }
      },

      async syncDownloadFlight(flightId: string): Promise<void> {
        patchState(store, {
          downloadingFlightId: flightId,
        });

        clearSyncError(flightId);

        try {
          await backendSync.downloadFlight(flightId);

          const localFlightListItems = await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            downloadingFlightId: null,
          });

          await this.loadBackendFlights();
        } catch (error) {
          console.error('Failed to download flight from backend', error);

          setSyncError(flightId, 'Download failed.');

          patchState(store, {
            downloadingFlightId: null,
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
  })
);