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
import { BackendAvailabilityService } from '../../../core/layout/app-shell/services/backend-availability.service';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { LocalFlightListItem } from '../data-access/flight-storage.interface';
import {
  BackendFlight,
  FlightVisibility,
} from '../models/backend-flight.model';
import {
  DEFAULT_FLIGHT_LIST_SORT,
  FlightListSort,
  FlightSortKey,
} from '../models/flight-list-sort';
import { BackendFlightsApiService } from '../services/backend-flights-api.service';
import { FlightBackendSyncService } from '../services/flight-backend-sync.service';
import { FlightListMergeService } from '../services/flight-list-merge.service';
import { FlightListSortService } from '../services/flight-list-sort.service';
import { FlightSaveService } from '../services/flight-save.service';
import { FlightSyncQueueService } from '../services/flight-sync-queue.service';

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
  deletingRemoteFlightId: string | null;
  updatingVisibilityFlightId: string | null;

  syncErrorByFlightId: Record<string, string>;
  uploadingAll: boolean;

  sort: FlightListSort;
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
  deletingRemoteFlightId: null,
  updatingVisibilityFlightId: null,

  syncErrorByFlightId: {},
  uploadingAll: false,

  sort: DEFAULT_FLIGHT_LIST_SORT,
};

export const FlightsStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => {
    const mergeService = inject(FlightListMergeService);
    const sortService = inject(FlightListSortService);

    const mergedFlightListItems = computed(() =>
      mergeService.merge(
        store.localFlightListItems(),
        store.backendFlights()
      )
    );

    return {
      flightListItems: computed(() =>
        sortService.sort(
          mergedFlightListItems(),
          store.sort()
        )
      ),

      localOnlyFlightIds: computed(() =>
        mergedFlightListItems()
          .filter((item) => item.syncStatus === 'localOnly')
          .map((item) => item.id)
      ),

      localOnlyCount: computed(
        () =>
          mergedFlightListItems().filter(
            (item) => item.syncStatus === 'localOnly'
          ).length
      ),
    };
  }),

  withMethods((store) => {
    const storage = inject(FlightIndexedDbService);
    const flightSaveService = inject(FlightSaveService);
    const backendFlightsApi = inject(BackendFlightsApiService);
    const backendSync = inject(FlightBackendSyncService);
    const backendAvailability = inject(
      BackendAvailabilityService
    );
    const errorService = inject(AppErrorService);
    const syncQueue = inject(FlightSyncQueueService);

    function clearSyncError(flightId: string): void {
      const currentErrors = store.syncErrorByFlightId();
      const {
        [flightId]: removedError,
        ...remainingErrors
      } = currentErrors;

      void removedError;

      patchState(store, {
        syncErrorByFlightId: remainingErrors,
      });
    }

    function setSyncError(
      flightId: string,
      message: string
    ): void {
      patchState(store, {
        syncErrorByFlightId: {
          ...store.syncErrorByFlightId(),
          [flightId]: message,
        },
      });
    }

    return {
      setSort(key: FlightSortKey): void {
        const currentSort = store.sort();

        patchState(store, {
          sort: {
            key,
            direction:
              currentSort.key === key &&
                currentSort.direction === 'asc'
                ? 'desc'
                : 'asc',
          },
        });
      },

      async loadFlights(): Promise<void> {
        patchState(store, {
          loading: true,
          backendFlightsLoading: false,
          error: null,
          backendFlightsError: null,
        });

        try {
          const localFlightListItems =
            await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            loading: false,
          });
        } catch (error) {
          patchState(store, {
            localFlightListItems: [],
            loading: false,
            error: errorService.getMessage(
              error,
              'Could not load local flights.'
            ),
          });
        }

        const backendAvailable =
          await backendAvailability.check();

        if (!backendAvailable) {
          patchState(store, {
            backendFlights: [],
            backendFlightsLoading: false,
            backendFlightsError: null,
          });

          return;
        }

        await this.loadBackendFlights();
      },

      async loadLocalFlights(): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          const localFlightListItems =
            await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            loading: false,
          });
        } catch (error) {
          patchState(store, {
            localFlightListItems: [],
            loading: false,
            error: errorService.getMessage(
              error,
              'Could not load local flights.'
            ),
          });
        }
      },

      async loadBackendFlights(): Promise<void> {
        const backendAvailable =
          await backendAvailability.check();

        if (!backendAvailable) {
          patchState(store, {
            backendFlights: [],
            backendFlightsLoading: false,
            backendFlightsError: null,
          });

          return;
        }

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
        } catch (error) {
          patchState(store, {
            backendFlights: [],
            backendFlightsLoading: false,
            backendFlightsError:
              errorService.getMessage(
                error,
                'Could not load remote flights.'
              ),
          });
        }
      },

      async importFile(file: File): Promise<void> {
        await this.importFiles([file]);
      },

      async importFiles(
        files: FileList | File[]
      ): Promise<void> {
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
            const result =
              await flightSaveService.saveFile(file);

            if (result.duplicate) {
              duplicateCount++;
              continue;
            }

            lastImportedFlightId = result.flightId;
          }

          const localFlightListItems =
            await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            loading: false,
            lastImportedFlightId,
            error:
              duplicateCount > 0
                ? `${duplicateCount} file(s) were already imported.`
                : null,
          });
        } catch (error) {
          patchState(store, {
            loading: false,
            error: errorService.getMessage(
              error,
              'Could not import flights.'
            ),
          });
        }
      },

      async syncUploadFlight(flightId: string): Promise<void> {
        patchState(store, {
          uploadingFlightId: flightId,
        });

        clearSyncError(flightId);

        try {
          await syncQueue.enqueueUpload(flightId);

          if (backendAvailability.available()) {
            await syncQueue.processQueue();
          }
        } catch (error) {
          setSyncError(
            flightId,
            errorService.getMessage(
              error,
              'Flight could not be queued for synchronization.'
            )
          );
        } finally {
          patchState(store, {
            uploadingFlightId: null,
          });
        }
      },

      async syncUploadAllFlights(): Promise<void> {
        const flightIds = store.localOnlyFlightIds();

        if (flightIds.length === 0) {
          return;
        }

        patchState(store, {
          uploadingAll: true,
          uploadingFlightId: null,
          error: null,
        });

        try {
          for (const flightId of flightIds) {
            patchState(store, {
              uploadingFlightId: flightId,
            });

            clearSyncError(flightId);

            await syncQueue.enqueueUpload(flightId);
          }

          if (backendAvailability.available()) {
            await syncQueue.processQueue();
          }
        } catch (error) {
          patchState(store, {
            error: errorService.getMessage(
              error,
              'Flights could not be queued for synchronization.'
            ),
          });
        } finally {
          patchState(store, {
            uploadingFlightId: null,
            uploadingAll: false,
          });
        }
      },

      async syncDownloadFlight(
        flightId: string
      ): Promise<void> {
        patchState(store, {
          downloadingFlightId: flightId,
        });

        clearSyncError(flightId);

        try {
          await backendSync.downloadFlight(flightId);

          const localFlightListItems =
            await storage.getFlightListItems();

          patchState(store, {
            localFlightListItems,
            downloadingFlightId: null,
          });

          await this.loadBackendFlights();
        } catch (error) {
          setSyncError(
            flightId,
            errorService.getMessage(
              error,
              'Flight download failed.'
            )
          );

          patchState(store, {
            downloadingFlightId: null,
          });
        }
      },

      async deleteFlight(
        flightId: string
      ): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          await storage.deleteFlight(flightId);

          const localFlightListItems =
            await storage.getFlightListItems();

          clearSyncError(flightId);

          patchState(store, {
            localFlightListItems,
            loading: false,
          });
        } catch (error) {
          patchState(store, {
            loading: false,
            error: errorService.getMessage(
              error,
              'Local flight could not be deleted.'
            ),
          });
        }
      },

      async deleteRemoteFlight(
        flightId: string
      ): Promise<void> {
        patchState(store, {
          deletingRemoteFlightId: flightId,
        });

        clearSyncError(flightId);

        try {
          await syncQueue.enqueueDelete(flightId);

          if (backendAvailability.available()) {
            await syncQueue.processQueue();
          }
        } catch (error) {
          setSyncError(
            flightId,
            errorService.getMessage(
              error,
              'Remote delete could not be queued.'
            )
          );
        } finally {
          patchState(store, {
            deletingRemoteFlightId: null,
          });
        }
      },

      async updateRemoteVisibility(
        flightId: string,
        visibility: FlightVisibility
      ): Promise<void> {
        patchState(store, {
          updatingVisibilityFlightId: flightId,
        });

        clearSyncError(flightId);

        try {
          await syncQueue.enqueueVisibilityChange(
            flightId,
            visibility
          );

          if (backendAvailability.available()) {
            await syncQueue.processQueue();
          }
        } catch (error) {
          setSyncError(
            flightId,
            errorService.getMessage(
              error,
              'Visibility update could not be queued.'
            )
          );
        } finally {
          patchState(store, {
            updatingVisibilityFlightId: null,
          });
        }
      },

      clearBackendState(): void {
        patchState(store, {
          backendFlights: [],
          backendFlightsLoading: false,
          backendFlightsError: null,

          uploadingFlightId: null,
          downloadingFlightId: null,
          deletingRemoteFlightId: null,
          updatingVisibilityFlightId: null,

          uploadingAll: false,
          syncErrorByFlightId: {},
        });
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

      clearSyncError(flightId: string): void {
        clearSyncError(flightId);
      },
    };
  })
);