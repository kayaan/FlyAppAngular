import { CalculatedFlightStats } from './calculated-flight-stats.model';

export interface BackendFlightImportRequest {
  id: string;
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  importedAtUtc: string;
  stats: CalculatedFlightStats | null;
}

/**
 * Temporary compatibility alias.
 *
 * New code should use BackendFlightImportRequest.
 */
export type ImportBackendFlightRequest = BackendFlightImportRequest;