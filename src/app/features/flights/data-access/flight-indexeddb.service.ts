import { Injectable } from '@angular/core';
import { DBSchema, IDBPDatabase, openDB } from 'idb';

import { Flight } from '../models/flight.model';
import { FlightStats } from '../models/flight-stats.model';
import { IgcFile } from '../models/igc-file.model';
import { TrackArrays } from '../models/track-arrays.model';

import {
  FlightDetails,
  FlightStorage,
  LocalFlightListItem,
  NewFlight,
  NewFlightImport,
  NewFlightStats,
} from './flight-storage.interface';
import { FlightSyncOperation, NewFlightSyncOperation } from '../models/flight-sync-operation.model';

interface FlightDbSchema extends DBSchema {
  flights: {
    key: string;
    value: Flight;
  };

  tracks: {
    key: string;
    value: {
      id: string;
      track: TrackArrays;
    };
  };

  stats: {
    key: string;
    value: FlightStats;
  };

  igcFiles: {
    key: string;
    value: IgcFile;
  };

  syncOutbox: {
    key: string;
    value: FlightSyncOperation;
    indexes: {
      'by-status': string;
      'by-flight-id': string;
      'by-created-at': string;
    };
  };
}

@Injectable({
  providedIn: 'root',
})
export class FlightIndexedDbService implements FlightStorage {
  private readonly dbName = 'flight-app-db';
  private readonly dbVersion = 1;

  private dbPromise: Promise<IDBPDatabase<FlightDbSchema>> | null = null;

  private getDb(): Promise<IDBPDatabase<FlightDbSchema>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<FlightDbSchema>(
        this.dbName,
        this.dbVersion,
        {
          upgrade(db) {
            if (!db.objectStoreNames.contains('flights')) {
              db.createObjectStore('flights', {
                keyPath: 'id',
              });
            }

            if (!db.objectStoreNames.contains('tracks')) {
              db.createObjectStore('tracks', {
                keyPath: 'id',
              });
            }

            if (!db.objectStoreNames.contains('stats')) {
              db.createObjectStore('stats', {
                keyPath: 'id',
              });
            }

            if (!db.objectStoreNames.contains('igcFiles')) {
              db.createObjectStore('igcFiles', {
                keyPath: 'id',
              });
            }

            if (!db.objectStoreNames.contains('syncOutbox')) {
              const syncOutboxStore = db.createObjectStore(
                'syncOutbox',
                {
                  keyPath: 'id',
                }
              );

              syncOutboxStore.createIndex(
                'by-status',
                'status'
              );

              syncOutboxStore.createIndex(
                'by-flight-id',
                'flightId'
              );

              syncOutboxStore.createIndex(
                'by-created-at',
                'createdAtUtc'
              );
            }
          },
        }
      );
    }

    return this.dbPromise;
  }

  async getSyncOperationsByFlightId(
    flightId: string
  ): Promise<FlightSyncOperation[]> {
    const db = await this.getDb();

    return db.getAllFromIndex(
      'syncOutbox',
      'by-flight-id',
      flightId
    );
  }

  async getAllSyncOperations(): Promise<
    FlightSyncOperation[]
  > {
    const db = await this.getDb();

    return db.getAll('syncOutbox');
  }

  async resetRetryableSyncOperations(): Promise<void> {
    const db = await this.getDb();
    const operations = await db.getAll('syncOutbox');

    const retryableOperations = operations.filter(
      (operation) =>
        operation.status === 'processing' ||
        operation.status === 'failed'
    );

    if (retryableOperations.length === 0) {
      return;
    }

    const transaction = db.transaction(
      'syncOutbox',
      'readwrite'
    );

    for (const operation of retryableOperations) {
      await transaction.store.put({
        ...operation,
        status: 'pending',
      });
    }

    await transaction.done;
  }

  async enqueueSyncOperation(
    operation: NewFlightSyncOperation
  ): Promise<FlightSyncOperation> {
    const db = await this.getDb();
    const createdAtUtc = new Date().toISOString();

    const entry = {
      ...operation,
      id: crypto.randomUUID(),
      createdAtUtc,
      status: 'pending',
      attempts: 0,
      lastAttemptAtUtc: null,
      lastError: null,
    } satisfies FlightSyncOperation;

    await db.put('syncOutbox', entry);

    return entry;
  }

  async getPendingSyncOperations(): Promise<
    FlightSyncOperation[]
  > {
    const db = await this.getDb();

    const operations = await db.getAllFromIndex(
      'syncOutbox',
      'by-status',
      'pending'
    );

    return operations.sort((a, b) =>
      a.createdAtUtc.localeCompare(b.createdAtUtc)
    );
  }

  async markSyncOperationProcessing(
    operationId: string
  ): Promise<void> {
    const db = await this.getDb();
    const operation = await db.get(
      'syncOutbox',
      operationId
    );

    if (!operation) {
      return;
    }

    await db.put('syncOutbox', {
      ...operation,
      status: 'processing',
      attempts: operation.attempts + 1,
      lastAttemptAtUtc: new Date().toISOString(),
      lastError: null,
    });
  }

  async markSyncOperationFailed(
    operationId: string,
    errorMessage: string
  ): Promise<void> {
    const db = await this.getDb();
    const operation = await db.get(
      'syncOutbox',
      operationId
    );

    if (!operation) {
      return;
    }

    await db.put('syncOutbox', {
      ...operation,
      status: 'failed',
      lastError: errorMessage,
    });
  }

  async removeSyncOperation(
    operationId: string
  ): Promise<void> {
    const db = await this.getDb();

    await db.delete('syncOutbox', operationId);
  }


  async getFlightListItems(): Promise<LocalFlightListItem[]> {
    const db = await this.getDb();

    const flights = await db.getAll('flights');

    const items: LocalFlightListItem[] = [];

    for (const flight of flights) {
      const stats = await db.get('stats', flight.id);

      items.push({
        flight,
        stats: stats ?? null,
      });
    }

    return items.sort((a, b) => {
      const dateA = a.flight.flightDate ?? a.flight.importedAtUtc;
      const dateB = b.flight.flightDate ?? b.flight.importedAtUtc;

      return dateB.localeCompare(dateA);
    });
  }

  async getFlights(): Promise<Flight[]> {
    const db = await this.getDb();

    return db.getAll('flights');
  }

  async getFlight(flightId: string): Promise<Flight | undefined> {
    const db = await this.getDb();

    return db.get('flights', flightId);
  }

  async getFlightDetails(flightId: string): Promise<FlightDetails | undefined> {
    const flight = await this.getFlight(flightId);

    if (!flight) {
      return undefined;
    }

    const [track, stats, igcFile] = await Promise.all([
      this.getTrack(flightId),
      this.getStats(flightId),
      this.getIgcFile(flightId),
    ]);

    return {
      flight,
      track,
      stats,
      igcFile,
    };
  }

  async existsFlight(flightId: string): Promise<boolean> {
    const db = await this.getDb();

    return (await db.get('flights', flightId)) !== undefined;
  }

  async saveFlight(flight: NewFlight): Promise<string> {
    const db = await this.getDb();

    await db.add('flights', flight);

    return flight.id;
  }

  async saveTrack(flightId: string, track: TrackArrays): Promise<void> {
    const db = await this.getDb();

    await db.put('tracks', {
      id: flightId,
      track,
    });
  }

  async saveStats(stats: NewFlightStats): Promise<string> {
    const db = await this.getDb();

    await db.put('stats', stats);

    return stats.id;
  }

  async saveIgcFile(igcFile: IgcFile): Promise<void> {
    const db = await this.getDb();

    await db.put('igcFiles', igcFile);
  }

  async saveCompleteImport(importData: NewFlightImport): Promise<string> {
    const db = await this.getDb();

    const tx = db.transaction(
      ['flights', 'tracks', 'stats', 'igcFiles'],
      'readwrite'
    );

    const flightId = importData.flight.id;

    await tx.objectStore('flights').add(importData.flight);

    await tx.objectStore('tracks').put({
      id: flightId,
      track: importData.track,
    });

    await tx.objectStore('stats').put({
      ...importData.stats,
      id: flightId,
    });

    await tx.objectStore('igcFiles').put({
      ...importData.igcFile,
      id: flightId,
    });

    await tx.done;

    return flightId;
  }

  async getTrack(flightId: string): Promise<TrackArrays | undefined> {
    const db = await this.getDb();

    const record = await db.get('tracks', flightId);

    return record?.track;
  }

  async getStats(flightId: string): Promise<FlightStats | undefined> {
    const db = await this.getDb();

    return db.get('stats', flightId);
  }

  async getIgcFile(flightId: string): Promise<IgcFile | undefined> {
    const db = await this.getDb();

    return db.get('igcFiles', flightId);
  }

  async deleteFlight(flightId: string): Promise<void> {
    const db = await this.getDb();

    const tx = db.transaction(
      ['flights', 'tracks', 'stats', 'igcFiles'],
      'readwrite'
    );

    await tx.objectStore('flights').delete(flightId);
    await tx.objectStore('tracks').delete(flightId);
    await tx.objectStore('stats').delete(flightId);
    await tx.objectStore('igcFiles').delete(flightId);

    await tx.done;
  }
}