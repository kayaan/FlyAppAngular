import { inject, Injectable } from '@angular/core';

import {
  NewFlight,
  NewFlightStats,
} from '../data-access/flight-storage.interface';
import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { FlightImportService } from './flight-import.service';
import { IgcFile } from '../models/igc-file.model';

export type SaveFlightResult = {
  flightId: string | null;
  duplicate: boolean;
};

@Injectable({
  providedIn: 'root',
})
export class FlightSaveService {
  private readonly flightImportService = inject(FlightImportService);
  private readonly storage = inject(FlightIndexedDbService);

  async saveFile(file: File): Promise<SaveFlightResult> {
    const igcText = await file.text();
    const analysis = await this.flightImportService.analyzeFile(file);

    const exists = await this.storage.existsFlight(analysis.id);

    if (exists) {
      return {
        flightId: null,
        duplicate: true,
      };
    }

    const nowUtc = new Date().toISOString();

    const flight: NewFlight = {
      id: analysis.id,
      fileName: analysis.fileName,
      flightDate: analysis.meta.date ?? null,
      pilot: analysis.meta.pilot ?? null,
      glider: analysis.meta.glider ?? null,
      importedAtUtc: nowUtc,
    };

    const stats: NewFlightStats = {
      id: analysis.id,

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
    };

    const igcFile: IgcFile = {
      id: analysis.id,
      fileName: file.name,
      content: igcText,
      sizeBytes: file.size,
      createdAtUtc: nowUtc,
    };

    const flightId = await this.storage.saveCompleteImport({
      flight,
      track: analysis.track,
      stats,
      igcFile,
    });

    return {
      flightId,
      duplicate: false,
    };
  }
}