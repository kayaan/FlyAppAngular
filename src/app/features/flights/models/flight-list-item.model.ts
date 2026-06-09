import { Flight } from './flight.model';
import { FlightStats } from './flight-stats.model';

export interface FlightListItem {
  flight: Flight;
  stats: FlightStats | null;
}