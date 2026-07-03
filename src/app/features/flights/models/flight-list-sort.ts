export type FlightSortKey =
  | 'flightDate'
  | 'pilot'
  | 'glider'
  | 'durationSec'
  | 'distanceM'
  | 'minAltGpsM'
  | 'maxAltGpsM'
  | 'syncStatus';

export type FlightSortDirection = 'asc' | 'desc';

export interface FlightListSort {
  key: FlightSortKey;
  direction: FlightSortDirection;
}

export const DEFAULT_FLIGHT_LIST_SORT: FlightListSort = {
  key: 'flightDate',
  direction: 'desc',
};