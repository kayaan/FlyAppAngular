import {
    DestroyRef,
    Injectable,
    inject,
    signal,
} from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AppErrorService } from '../../../core/errors/app-error.service';
import { BackendAvailabilityService } from '../../../core/layout/app-shell/services/backend-availability.service';

import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { FlightSyncOperation, FlightVisibility } from '../models/flight-sync-operation.model';

import { BackendFlightsApiService } from './backend-flights-api.service';
import { FlightBackendSyncService } from './flight-backend-sync.service';

const BACKGROUND_RETRY_INTERVAL_MS = 10_000;

@Injectable({
    providedIn: 'root',
})
export class FlightSyncQueueService {
    private readonly storage = inject(
        FlightIndexedDbService
    );

    private readonly backendSync = inject(
        FlightBackendSyncService
    );

    private readonly backendApi = inject(
        BackendFlightsApiService
    );

    private readonly errorService = inject(
        AppErrorService
    );

    private readonly backendAvailability = inject(
        BackendAvailabilityService
    );

    private readonly destroyRef = inject(DestroyRef);

    private readonly queuedFlightIdsSignal =
        signal<ReadonlySet<string>>(new Set());

    private readonly completedRevisionSignal = signal(0);

    readonly completedRevision =
        this.completedRevisionSignal.asReadonly();

    readonly queuedFlightIds =
        this.queuedFlightIdsSignal.asReadonly();

    private processingPromise: Promise<void> | null =
        null;

    private backgroundCheckPromise:
        Promise<void> | null = null;

    private retryTimerId: number | null = null;
    private monitorStarted = false;

    startBackgroundProcessing(): void {
        if (this.monitorStarted) {
            return;
        }

        this.monitorStarted = true;

        void this.tryProcessInBackground();

        this.retryTimerId = window.setInterval(() => {
            void this.tryProcessInBackground();
        }, BACKGROUND_RETRY_INTERVAL_MS);

        const onlineListener = (): void => {
            void this.tryProcessInBackground();
        };

        window.addEventListener(
            'online',
            onlineListener
        );

        this.destroyRef.onDestroy(() => {
            if (this.retryTimerId !== null) {
                window.clearInterval(this.retryTimerId);
                this.retryTimerId = null;
            }

            window.removeEventListener(
                'online',
                onlineListener
            );
        });
    }

    async enqueueUpload(
        flightId: string
    ): Promise<void> {
        const existingOperations =
            await this.storage.getSyncOperationsByFlightId(
                flightId
            );

        const uploadAlreadyQueued =
            existingOperations.some(
                (operation) =>
                    operation.type === 'upload' &&
                    (
                        operation.status === 'pending' ||
                        operation.status === 'processing' ||
                        operation.status === 'failed'
                    )
            );

        if (uploadAlreadyQueued) {
            return;
        }

        await this.storage.enqueueSyncOperation({
            type: 'upload',
            flightId,
            changedAtUtc: new Date().toISOString(),
        });

        await this.refreshQueueState();

        /*
         * Sofort versuchen.
         *
         * Ist das Backend offline, bleibt der Eintrag
         * einfach in der Outbox.
         */
        void this.tryProcessInBackground();
    }

    async refreshQueueState(): Promise<void> {
        const operations =
            await this.storage.getAllSyncOperations();

        this.queuedFlightIdsSignal.set(
            new Set(
                operations
                    .filter(
                        (operation) =>
                            operation.type === 'upload'
                    )
                    .map(
                        (operation) => operation.flightId
                    )
            )
        );
    }

    isUploadQueued(flightId: string): boolean {
        return this.queuedFlightIdsSignal().has(
            flightId
        );
    }

    async resumeQueue(): Promise<void> {
        /*
         * Nach einem abgebrochenen Request kann ein
         * Eintrag auf "processing" stehen bleiben.
         *
         * Fehlgeschlagene Einträge müssen ebenfalls
         * wieder auf "pending", sonst werden sie nie
         * erneut verarbeitet.
         */
        await this.storage.resetRetryableSyncOperations();

        await this.refreshQueueState();
        await this.processQueue();
    }

    processQueue(): Promise<void> {
        if (this.processingPromise) {
            return this.processingPromise;
        }

        this.processingPromise =
            this.processPendingOperations()
                .finally(() => {
                    this.processingPromise = null;
                });

        return this.processingPromise;
    }

    private tryProcessInBackground(): Promise<void> {
        if (this.backgroundCheckPromise) {
            return this.backgroundCheckPromise;
        }

        this.backgroundCheckPromise =
            this.checkBackendAndProcess()
                .catch((error: unknown) => {
                    console.warn(
                        'Background sync check failed.',
                        error
                    );
                })
                .finally(() => {
                    this.backgroundCheckPromise = null;
                });

        return this.backgroundCheckPromise;
    }

    private async checkBackendAndProcess(): Promise<void> {
        const operations =
            await this.storage.getAllSyncOperations();

        if (operations.length === 0) {
            return;
        }

        const backendAvailable =
            await this.backendAvailability.checkFresh();

        if (!backendAvailable) {
            return;
        }

        await this.resumeQueue();
    }

    private async processPendingOperations(): Promise<void> {
        const operations =
            await this.storage.getPendingSyncOperations();

        for (const operation of operations) {
            await this.processOperation(operation);
        }
    }

    private async processOperation(
        operation: FlightSyncOperation
    ): Promise<void> {
        await this.storage.markSyncOperationProcessing(
            operation.id
        );

        try {
            await this.executeOperation(operation);

            await this.storage.removeSyncOperation(
                operation.id
            );

            this.completedRevisionSignal.update(
                (revision) => revision + 1
            );
        } catch (error) {
            const message = this.errorService.getMessage(
                error,
                'Flight synchronization failed.'
            );

            await this.storage.markSyncOperationFailed(
                operation.id,
                message
            );
        } finally {
            await this.refreshQueueState();
        }
    }

    private async executeOperation(
        operation: FlightSyncOperation
    ): Promise<void> {
        switch (operation.type) {
            case 'upload':
                await this.backendSync.uploadFlight(
                    operation.flightId
                );
                return;

            case 'delete':
                await firstValueFrom(
                    this.backendApi.deleteFlight(
                        operation.flightId
                    )
                );
                return;

            case 'visibility-change':
                await firstValueFrom(
                    this.backendApi.updateVisibility(
                        operation.flightId,
                        operation.visibility
                    )
                );
                return;
        }
    }

    async enqueueVisibilityChange(
        flightId: string,
        visibility: FlightVisibility
    ): Promise<void> {
        const existingOperations =
            await this.storage.getSyncOperationsByFlightId(
                flightId
            );

        for (const operation of existingOperations) {
            if (operation.type === 'visibility-change') {
                await this.storage.removeSyncOperation(
                    operation.id
                );
            }
        }

        await this.storage.enqueueSyncOperation({
            type: 'visibility-change',
            flightId,
            visibility,
            changedAtUtc: new Date().toISOString(),
        });

        await this.refreshQueueState();

        void this.tryProcessInBackground();
    }

    async enqueueDelete(
        flightId: string
    ): Promise<void> {
        const existingOperations =
            await this.storage.getSyncOperationsByFlightId(
                flightId
            );

        for (const operation of existingOperations) {
            if (
                operation.type === 'upload' ||
                operation.type === 'visibility-change' ||
                operation.type === 'delete'
            ) {
                await this.storage.removeSyncOperation(
                    operation.id
                );
            }
        }

        await this.storage.enqueueSyncOperation({
            type: 'delete',
            flightId,
            changedAtUtc: new Date().toISOString(),
        });

        await this.refreshQueueState();

        void this.tryProcessInBackground();
    }
}