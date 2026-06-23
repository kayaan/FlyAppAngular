import { CalculatedFlightStats } from "./calculated-flight-stats.model";

export type FlightVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';

export interface BackendFlight {
  id: string;        // SHA-256 hash
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  visibility: FlightVisibility;
  importedAtUtc: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}

export interface CreateBackendFlightRequest {
  id: string; // SHA-256 hash
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  importedAtUtc: string;
}

export interface ImportBackendFlightStatsRequest {
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

export interface ImportBackendFlightRequest {
  id: string;
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  importedAtUtc: string;
  stats: ImportBackendFlightStatsRequest | null;
}