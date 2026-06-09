import { Flight } from '../models/flight.model';
import { TrackArrays } from '../models/track-arrays.model';
import { Climb } from '../models/climb.model';
import { FlightStats } from '../models/flight-stats.model';

export type NewFlight = Omit<Flight, 'id'>;
export type NewClimb = Omit<Climb, 'id'>;
export type NewFlightStats = Omit<FlightStats, 'id'>;

export interface FlightDetails {
  flight: Flight;
  track: TrackArrays | undefined;
  climbs: Climb[];
  stats: FlightStats[];
}

export interface FlightStorage {
  /**
   * Loads all imported flights.
   *
   * Usually used by the flight list page.
   */
  getFlights(): Promise<Flight[]>;

  /**
   * Loads one flight by id.
   */
  getFlight(flightId: number): Promise<Flight | undefined>;

  /**
   * Loads the complete flight details:
   * - metadata
   * - track
   * - climbs
   * - stats
   */
  getFlightDetails(flightId: number): Promise<FlightDetails | undefined>;

  /**
   * Checks whether a file with the same hash was already imported.
   *
   * Used for duplicate detection.
   */
  existsByFileHash(fileHash: string): Promise<boolean>;

  /**
   * Saves one flight metadata record.
   *
   * The database creates the id via autoIncrement.
   * Returns the created flight id.
   */
  saveFlight(flight: NewFlight): Promise<number>;

  /**
   * Saves the track arrays for one flight.
   *
   * The track uses flightId as its key.
   */
  saveTrack(flightId: number, track: TrackArrays): Promise<void>;

  /**
   * Saves detected climbs for one flight.
   *
   * The database creates climb ids via autoIncrement.
   * Returns the created climb ids.
   */
  saveClimbs(climbs: NewClimb[]): Promise<number[]>;

  /**
   * Saves calculated stats.
   *
   * This can include:
   * - full flight stats
   * - climb stats
   * - segment stats
   *
   * The database creates stats ids via autoIncrement.
   * Returns the created stats ids.
   */
  saveStats(stats: NewFlightStats[]): Promise<number[]>;

  /**
   * Loads the track arrays for one flight.
   */
  getTrack(flightId: number): Promise<TrackArrays | undefined>;

  /**
   * Loads all climbs for one flight.
   */
  getClimbs(flightId: number): Promise<Climb[]>;

  /**
   * Loads all stats for one flight.
   */
  getStats(flightId: number): Promise<FlightStats[]>;

  /**
   * Deletes one flight and all related data.
   */
  deleteFlight(flightId: number): Promise<void>;
}