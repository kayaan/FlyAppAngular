import { FlightVisibility } from './backend-flight.model';

export interface FlightSyncPackageDto {
  flight: SyncFlightDto;
  stats: SyncFlightStatsDto;
  igcFile: SyncIgcFileDto;
  trackFile: SyncTrackFileDto;
}

export interface SyncFlightDto {
  id: string;
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  visibility: FlightVisibility;
  importedAtUtc: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface SyncFlightStatsDto {
  flightId: string;

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

export interface SyncIgcFileDto {
  flightId: string;
  fileName: string;
  contentBase64: string;
  sizeBytes: number;
}

export interface SyncTrackFileDto {
  flightId: string;
  contentBase64: string;
  sizeBytes: number;
  formatVersion: number;
  pointCount: number;
}

export interface SyncTrackFileContent {
  formatVersion: number;
  timeSec: number[];
  latE7: number[];
  lonE7: number[];
  altGpsCm: number[];
  altBaroCm: number[];
}