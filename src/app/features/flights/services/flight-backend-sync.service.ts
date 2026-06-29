import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { FlightIndexedDbService } from '../data-access/flight-indexeddb.service';
import { Flight } from '../models/flight.model';
import { FlightStats } from '../models/flight-stats.model';
import { TrackArrays } from '../models/track-arrays.model';

import { FlightSyncPackageDto, SyncTrackFileContent } from '../models/flight-sync-package.model';
import { IgcFile } from '../models/igc-file.model';

@Injectable({
  providedIn: 'root',
})
export class FlightBackendSyncService {
  private readonly http = inject(HttpClient);
  private readonly storage = inject(FlightIndexedDbService);

  private readonly apiBaseUrl = '/api';

  async uploadFlight(flightId: string): Promise<Flight> {
    const details = await this.storage.getFlightDetails(flightId);

    if (!details) {
      throw new Error(`Local flight not found: ${flightId}`);
    }

    if (!details.stats) {
      throw new Error(`Local stats missing for flight: ${flightId}`);
    }

    if (!details.track) {
      throw new Error(`Local track missing for flight: ${flightId}`);
    }

    if (!details.igcFile) {
      throw new Error(`Local IGC file missing for flight: ${flightId}`);
    }

    const metadata = this.createMetadata(
      details.flight,
      details.stats,
      details.track
    );

    const formData = new FormData();

    formData.append(
      'metadata',
      new Blob([JSON.stringify(metadata)], {
        type: 'application/json',
      })
    );

    formData.append(
      'file',
      new Blob([details.igcFile.content], {
        type: 'text/plain',
      }),
      details.igcFile.fileName
    );

    return await firstValueFrom(
      this.http.post<Flight>(
        `${this.apiBaseUrl}/flights/sync/upload`,
        formData,
        {
          withCredentials: true,
        }
      )
    );
  }

  async downloadFlight(flightId: string): Promise<Flight> {
    const pkg = await firstValueFrom(
      this.http.get<FlightSyncPackageDto>(
        `${this.apiBaseUrl}/flights/${flightId}/sync/package`,
        {
          withCredentials: true,
        }
      )
    );

    const trackJson = this.base64ToText(pkg.trackFile.contentBase64);
    const trackContent = JSON.parse(trackJson) as SyncTrackFileContent;

    const flight: Flight = {
      id: pkg.flight.id,
      fileName: pkg.flight.fileName,
      flightDate: pkg.flight.flightDate,
      pilot: pkg.flight.pilot,
      glider: pkg.flight.glider,
      importedAtUtc: pkg.flight.importedAtUtc,
    };

    const stats: FlightStats = {
      id: pkg.stats.flightId,

      startIndex: pkg.stats.startIndex,
      endIndex: pkg.stats.endIndex,
      fixCount: pkg.stats.fixCount,

      startTimeSec: pkg.stats.startTimeSec,
      endTimeSec: pkg.stats.endTimeSec,
      durationSec: pkg.stats.durationSec,

      distanceM: pkg.stats.distanceM,

      minAltGpsM: pkg.stats.minAltGpsM,
      maxAltGpsM: pkg.stats.maxAltGpsM,
      gainGpsM: pkg.stats.gainGpsM,

      minAltBaroM: pkg.stats.minAltBaroM,
      maxAltBaroM: pkg.stats.maxAltBaroM,
      gainBaroM: pkg.stats.gainBaroM,
    };

    const track: TrackArrays = {
      timeSec: new Int32Array(trackContent.timeSec),
      latE7: new Int32Array(trackContent.latE7),
      lonE7: new Int32Array(trackContent.lonE7),
      altGpsCm: new Int32Array(trackContent.altGpsCm),
      altBaroCm: new Int32Array(trackContent.altBaroCm),
    };

    const igcFile: IgcFile = {
      id: pkg.igcFile.flightId,
      fileName: pkg.igcFile.fileName,
      content: this.base64ToText(pkg.igcFile.contentBase64),
      sizeBytes: pkg.igcFile.sizeBytes,
      createdAtUtc: new Date().toISOString(),
    };

    await this.storage.saveCompleteImport({
      flight,
      track,
      stats,
      igcFile,
    });

    return flight;
  }

  private base64ToText(base64: string): string {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);

    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }

    return new TextDecoder('utf-8').decode(bytes);
  }

  private createMetadata(
    flight: Flight,
    stats: FlightStats,
    track: TrackArrays
  ): SyncFlightUploadRequest {
    return {
      id: flight.id,
      fileName: flight.fileName,
      flightDate: flight.flightDate ?? null,
      pilot: flight.pilot ?? null,
      glider: flight.glider ?? null,
      importedAtUtc: flight.importedAtUtc,

      stats: {
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
      },

      track: {
        formatVersion: 1,
        timeSec: Array.from(track.timeSec),
        latE7: Array.from(track.latE7),
        lonE7: Array.from(track.lonE7),
        altGpsCm: Array.from(track.altGpsCm),
        altBaroCm: Array.from(track.altBaroCm),
      },
    };
  }
}

import { firstValueFrom } from 'rxjs';

interface SyncFlightUploadRequest {
  id: string;
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  importedAtUtc: string;

  stats: SyncFlightStatsRequest;
  track: SyncFlightTrackRequest;
}

interface SyncFlightStatsRequest {
  startIndex: number;
  endIndex: number;
  fixCount: number;

  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;

  distanceM: number;

  minAltGpsM: number;
  maxAltGpsM: number;
  gainGpsM: number;

  minAltBaroM: number;
  maxAltBaroM: number;
  gainBaroM: number;
}

interface SyncFlightTrackRequest {
  formatVersion: number;

  timeSec: number[];
  latE7: number[];
  lonE7: number[];
  altGpsCm: number[];
  altBaroCm: number[];
}