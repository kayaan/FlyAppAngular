export type BackendFlightVisibility = 'PRIVATE' | 'UNLISTED' | 'PUBLIC';

export interface BackendFlight {
  id: string; // SHA-256 of original IGC bytes
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  visibility: BackendFlightVisibility;
  importedAtUtc: string;
  createdAtUtc: string;
  updatedAtUtc: string;
}