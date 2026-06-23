import { CalculatedFlightStats } from './calculated-flight-stats.model';

export interface ImportBackendFlightRequest {
  id: string;
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  importedAtUtc: string;
  stats: CalculatedFlightStats | null;
}