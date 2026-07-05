export type FlightVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';

export interface BackendFlight {
  id: string; // SHA-256 hash
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