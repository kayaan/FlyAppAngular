import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppErrorService } from '../../../core/errors/app-error.service';
import { BackendAvailabilityService } from '../../../core/layout/app-shell/services/backend-availability.service';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { FlightSyncOperation } from '../models/flight-sync-operation.model';
import { BackendFlightsApiService } from './backend-flights-api.service';
import { FlightBackendSyncService } from './flight-backend-sync.service';
import { FlightSyncQueueService } from './flight-sync-queue.service';

describe('FlightSyncQueueService', () => {
  let service: FlightSyncQueueService;

  let storage: {
    getSyncOperationsByFlightId: ReturnType<typeof vi.fn>;
    enqueueSyncOperation: ReturnType<typeof vi.fn>;
    getAllSyncOperations: ReturnType<typeof vi.fn>;
    getPendingSyncOperations: ReturnType<typeof vi.fn>;
    markSyncOperationProcessing: ReturnType<typeof vi.fn>;
    markSyncOperationFailed: ReturnType<typeof vi.fn>;
    removeSyncOperation: ReturnType<typeof vi.fn>;
    resetRetryableSyncOperations: ReturnType<typeof vi.fn>;
  };

  let backendSync: {
    uploadFlight: ReturnType<typeof vi.fn>;
  };

  let backendApi: {
    deleteFlight: ReturnType<typeof vi.fn>;
    updateVisibility: ReturnType<typeof vi.fn>;
  };

  let backendAvailability: {
    checkFresh: ReturnType<typeof vi.fn>;
  };

  let errorService: {
    getMessage: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    storage = {
      getSyncOperationsByFlightId: vi.fn().mockResolvedValue([]),
      enqueueSyncOperation: vi.fn().mockResolvedValue(undefined),
      getAllSyncOperations: vi.fn().mockResolvedValue([]),
      getPendingSyncOperations: vi.fn().mockResolvedValue([]),
      markSyncOperationProcessing: vi.fn().mockResolvedValue(undefined),
      markSyncOperationFailed: vi.fn().mockResolvedValue(undefined),
      removeSyncOperation: vi.fn().mockResolvedValue(undefined),
      resetRetryableSyncOperations: vi.fn().mockResolvedValue(undefined),
    };

    backendSync = {
      uploadFlight: vi.fn().mockResolvedValue({}),
    };

    backendApi = {
      deleteFlight: vi.fn().mockReturnValue(of(undefined)),
      updateVisibility: vi.fn().mockReturnValue(of(undefined)),
    };

    backendAvailability = {
      checkFresh: vi.fn().mockResolvedValue(true),
    };

    errorService = {
      getMessage: vi
        .fn()
        .mockReturnValue('Flight synchronization failed.'),
    };

    TestBed.configureTestingModule({
      providers: [
        FlightSyncQueueService,
        {
          provide: FlightIndexedDbService,
          useValue: storage,
        },
        {
          provide: FlightBackendSyncService,
          useValue: backendSync,
        },
        {
          provide: BackendFlightsApiService,
          useValue: backendApi,
        },
        {
          provide: BackendAvailabilityService,
          useValue: backendAvailability,
        },
        {
          provide: AppErrorService,
          useValue: errorService,
        },
      ],
    });

    service = TestBed.inject(FlightSyncQueueService);
  });

  it('should enqueue an upload operation', async () => {
    storage.getAllSyncOperations.mockResolvedValue([
      createUploadOperation(),
    ]);

    await service.enqueueUpload('flight-1');

    expect(storage.enqueueSyncOperation).toHaveBeenCalledOnce();

    expect(storage.enqueueSyncOperation).toHaveBeenCalledWith({
      type: 'upload',
      flightId: 'flight-1',
      changedAtUtc: expect.any(String),
    });

    expect(service.isUploadQueued('flight-1')).toBe(true);
  });

  it('should not enqueue the same upload twice', async () => {
    storage.getSyncOperationsByFlightId.mockResolvedValue([
      createUploadOperation(),
    ]);

    await service.enqueueUpload('flight-1');

    expect(storage.enqueueSyncOperation).not.toHaveBeenCalled();
  });

  it('should consider a failed upload already queued', async () => {
    storage.getSyncOperationsByFlightId.mockResolvedValue([
      createUploadOperation({
        status: 'failed',
        lastError: 'Backend unavailable',
      }),
    ]);

    await service.enqueueUpload('flight-1');

    expect(storage.enqueueSyncOperation).not.toHaveBeenCalled();
  });

  it('should process an upload operation successfully', async () => {
    const operation = createUploadOperation();

    storage.getPendingSyncOperations.mockResolvedValue([
      operation,
    ]);

    await service.processQueue();

    expect(
      storage.markSyncOperationProcessing
    ).toHaveBeenCalledWith(operation.id);

    expect(backendSync.uploadFlight).toHaveBeenCalledWith(
      operation.flightId
    );

    expect(storage.removeSyncOperation).toHaveBeenCalledWith(
      operation.id
    );

    expect(
      storage.markSyncOperationFailed
    ).not.toHaveBeenCalled();
  });

  it('should process a delete operation successfully', async () => {
    const operation = createDeleteOperation();

    storage.getPendingSyncOperations.mockResolvedValue([
      operation,
    ]);

    await service.processQueue();

    expect(backendApi.deleteFlight).toHaveBeenCalledWith(
      operation.flightId
    );

    expect(storage.removeSyncOperation).toHaveBeenCalledWith(
      operation.id
    );
  });

  it('should process a visibility operation successfully', async () => {
    const operation = createVisibilityOperation();

    storage.getPendingSyncOperations.mockResolvedValue([
      operation,
    ]);

    await service.processQueue();

    expect(backendApi.updateVisibility).toHaveBeenCalledWith(
      operation.flightId,
      'PUBLIC'
    );

    expect(storage.removeSyncOperation).toHaveBeenCalledWith(
      operation.id
    );
  });

  it('should mark an operation as failed when synchronization fails', async () => {
    const operation = createUploadOperation();

    storage.getPendingSyncOperations.mockResolvedValue([
      operation,
    ]);

    backendSync.uploadFlight.mockRejectedValue(
      new Error('Backend unavailable')
    );

    errorService.getMessage.mockReturnValue(
      'Backend unavailable'
    );

    await service.processQueue();

    expect(storage.markSyncOperationFailed).toHaveBeenCalledWith(
      operation.id,
      'Backend unavailable'
    );

    expect(storage.removeSyncOperation).not.toHaveBeenCalled();
  });

  it('should continue processing after a failed operation', async () => {
    const failedOperation = createUploadOperation({
      id: 'operation-1',
      flightId: 'flight-1',
    });

    const successfulOperation = createUploadOperation({
      id: 'operation-2',
      flightId: 'flight-2',
    });

    storage.getPendingSyncOperations.mockResolvedValue([
      failedOperation,
      successfulOperation,
    ]);

    backendSync.uploadFlight
      .mockRejectedValueOnce(new Error('Upload failed'))
      .mockResolvedValueOnce({});

    await service.processQueue();

    expect(storage.markSyncOperationFailed).toHaveBeenCalledWith(
      'operation-1',
      'Flight synchronization failed.'
    );

    expect(storage.removeSyncOperation).toHaveBeenCalledWith(
      'operation-2'
    );

    expect(backendSync.uploadFlight).toHaveBeenCalledTimes(2);
  });

  it('should expose queued upload flight ids', async () => {
    storage.getAllSyncOperations.mockResolvedValue([
      createUploadOperation({
        flightId: 'flight-1',
      }),
      createUploadOperation({
        id: 'operation-2',
        flightId: 'flight-2',
      }),
      createDeleteOperation({
        id: 'operation-3',
        flightId: 'flight-3',
      }),
    ]);

    await service.refreshQueueState();

    expect(service.isUploadQueued('flight-1')).toBe(true);
    expect(service.isUploadQueued('flight-2')).toBe(true);
    expect(service.isUploadQueued('flight-3')).toBe(false);
  });
});

function createUploadOperation(
  overrides: Partial<FlightSyncOperation> = {}
): FlightSyncOperation {
  return {
    id: 'operation-upload',
    type: 'upload',
    flightId: 'flight-1',
    changedAtUtc: '2026-07-13T18:00:00.000Z',
    createdAtUtc: '2026-07-13T18:00:00.000Z',
    status: 'pending',
    attempts: 0,
    lastAttemptAtUtc: null,
    lastError: null,
    ...overrides,
  } as FlightSyncOperation;
}

function createDeleteOperation(
  overrides: Partial<FlightSyncOperation> = {}
): FlightSyncOperation {
  return {
    id: 'operation-delete',
    type: 'delete',
    flightId: 'flight-1',
    changedAtUtc: '2026-07-13T18:00:00.000Z',
    createdAtUtc: '2026-07-13T18:00:00.000Z',
    status: 'pending',
    attempts: 0,
    lastAttemptAtUtc: null,
    lastError: null,
    ...overrides,
  } as FlightSyncOperation;
}

function createVisibilityOperation(
  overrides: Partial<FlightSyncOperation> = {}
): FlightSyncOperation {
  return {
    id: 'operation-visibility',
    type: 'visibility-change',
    flightId: 'flight-1',
    visibility: 'PUBLIC',
    changedAtUtc: '2026-07-13T18:00:00.000Z',
    createdAtUtc: '2026-07-13T18:00:00.000Z',
    status: 'pending',
    attempts: 0,
    lastAttemptAtUtc: null,
    lastError: null,
    ...overrides,
  } as FlightSyncOperation;
}