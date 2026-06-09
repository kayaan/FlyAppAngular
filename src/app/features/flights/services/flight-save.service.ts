import { Injectable, inject } from '@angular/core';

import { FlightImportService } from './flight-import.service';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';

import {
  NewFlight,
  NewFlightStats,
} from '../data-access/flight-storage.interface';

export interface SaveFlightResult {
  flightId: number;
  fileName: string;
  fileHash: string;
  duplicate: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class FlightSaveService {
  private readonly flightImportService = inject(FlightImportService);
  private readonly storage = inject(FlightIndexedDbService);

  /**
   * Imports, analyzes and saves one IGC file.
   *
   * The save operation itself is done in one IndexedDB transaction.
   */
  async saveFile(file: File): Promise<SaveFlightResult> {
    const analysis = await this.flightImportService.analyzeFile(file);

    const alreadyExists = await this.storage.existsByFileHash(analysis.fileHash);

    if (alreadyExists) {
      return {
        flightId: 0,
        fileName: analysis.fileName,
        fileHash: analysis.fileHash,
        duplicate: true,
      };
    }

    const nowUtc = new Date().toISOString();

    const newFlight: NewFlight = {
      fileName: analysis.fileName,
      fileHash: analysis.fileHash,
      importedAtUtc: nowUtc,
    };

    const stats: NewFlightStats[] = [
      {
        scopeType: 'flight',
        scopeId: null,
        statsVersion: 1,

        startIndex: analysis.stats.startIndex,
        endIndex: analysis.stats.endIndex,
        fixCount: analysis.stats.fixCount,

        startTimeSec: analysis.stats.startTimeSec,
        endTimeSec: analysis.stats.endTimeSec,
        durationSec: analysis.stats.durationSec,

        distanceM: analysis.stats.distanceM,

        minAltGpsM: analysis.stats.minAltGpsM,
        maxAltGpsM: analysis.stats.maxAltGpsM,
        gainGpsM: analysis.stats.gainGpsM,

        minAltBaroM: analysis.stats.minAltBaroM,
        maxAltBaroM: analysis.stats.maxAltBaroM,
        gainBaroM: analysis.stats.gainBaroM,

        avgSpeedKmh: analysis.stats.avgSpeedKmh,
        maxSpeedKmh: analysis.stats.maxSpeedKmh,

        calculatedAtUtc: nowUtc,
      },
    ];

    const flightId = await this.storage.saveCompleteImport({
      flight: newFlight,
      track: analysis.track,
      climbs: analysis.climbs,
      stats,
    });

    return {
      flightId,
      fileName: analysis.fileName,
      fileHash: analysis.fileHash,
      duplicate: false,
    };
  }
}