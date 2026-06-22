import { Flight } from './flight.model';
import { BackendFlight } from './backend-flight.model';

export type FlightSyncStatus =
  | 'synced'
  | 'localOnly'
  | 'remoteOnly'
  | 'uploading'
  | 'downloading'
  | 'error';

export interface FlightListItem {
  fileHash: string;
  localFlight: Flight | null;
  backendFlight: BackendFlight | null;
  syncStatus: FlightSyncStatus;
}