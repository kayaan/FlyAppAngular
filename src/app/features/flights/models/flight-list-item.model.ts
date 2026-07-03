import { BackendFlight } from './backend-flight.model';
import { Flight } from './flight.model';
import { FlightStats } from './flight-stats.model';

export type FlightSyncStatus =
  | 'synced'
  | 'localOnly'
  | 'remoteOnly'
  | 'uploading'
  | 'downloading'
  | 'error';

export interface FlightListItem {
  id: string; // SHA-256 of original IGC bytes

  localFlight: Flight | null;
  
  backendFlight: BackendFlight | null;

  localStats: FlightStats | null;

  syncStatus: FlightSyncStatus;
}