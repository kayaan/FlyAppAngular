import { Flight } from './flight.model';
import { TrackArrays } from './track-arrays.model';
import { Climb } from './climb.model';
import { FlightStats } from './flight-stats.model';

export interface ImportResult {
  flight: Flight;
  track: TrackArrays;
  climbs: Climb[];
  stats: FlightStats[];
}