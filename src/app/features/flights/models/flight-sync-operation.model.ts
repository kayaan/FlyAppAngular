export type FlightSyncOperationStatus =
  | 'pending'
  | 'processing'
  | 'failed';

export type FlightVisibility =
  | 'PRIVATE'
  | 'UNLISTED'
  | 'PUBLIC';

interface FlightSyncOperationBase {
  id: string;
  flightId: string;

  /**
   * Zeitpunkt der fachlichen Änderung.
   * Wird für Last Write Wins verwendet.
   */
  changedAtUtc: string;

  createdAtUtc: string;

  status: FlightSyncOperationStatus;

  attempts: number;

  lastAttemptAtUtc: string | null;

  lastError: string | null;
}

export interface UploadFlightSyncOperation
  extends FlightSyncOperationBase {
  type: 'upload';
}

export interface DeleteFlightSyncOperation
  extends FlightSyncOperationBase {
  type: 'delete';
}

export interface VisibilityFlightSyncOperation
  extends FlightSyncOperationBase {
  type: 'visibility-change';

  visibility: FlightVisibility;
}

export type FlightSyncOperation =
  | UploadFlightSyncOperation
  | DeleteFlightSyncOperation
  | VisibilityFlightSyncOperation;

type GeneratedSyncOperationFields =
  | 'id'
  | 'createdAtUtc'
  | 'status'
  | 'attempts'
  | 'lastAttemptAtUtc'
  | 'lastError';

export type NewFlightSyncOperation =
  | Omit<
      UploadFlightSyncOperation,
      GeneratedSyncOperationFields
    >
  | Omit<
      DeleteFlightSyncOperation,
      GeneratedSyncOperationFields
    >
  | Omit<
      VisibilityFlightSyncOperation,
      GeneratedSyncOperationFields
    >;