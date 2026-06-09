import { Flight } from '../models/flight.model';
import { TrackArrays } from '../models/track-arrays.model';
import { Climb } from '../models/climb.model';
import { FlightStats } from '../models/flight-stats.model';

export type NewFlight = Omit<Flight, 'id'>;
export type NewClimb = Omit<Climb, 'id' | 'flightId'>;
export type NewFlightStats = Omit<FlightStats, 'id' | 'flightId'>;

export interface NewFlightImport {
  flight: NewFlight;
  track: TrackArrays;
  climbs: NewClimb[];
  stats: NewFlightStats[];
}

export interface FlightDetails {
  flight: Flight;
  track: TrackArrays | undefined;
  climbs: Climb[];
  stats: FlightStats[];
}

export interface FlightStorage {
  getFlights(): Promise<Flight[]>;

  getFlight(flightId: number): Promise<Flight | undefined>;

  getFlightDetails(flightId: number): Promise<FlightDetails | undefined>;

  existsByFileHash(fileHash: string): Promise<boolean>;

  saveFlight(flight: NewFlight): Promise<number>;

  saveTrack(flightId: number, track: TrackArrays): Promise<void>;

  saveClimbs(flightId: number, climbs: NewClimb[]): Promise<number[]>;

  saveStats(flightId: number, stats: NewFlightStats[]): Promise<number[]>;

  saveCompleteImport(importData: NewFlightImport): Promise<number>;

  getTrack(flightId: number): Promise<TrackArrays | undefined>;

  getClimbs(flightId: number): Promise<Climb[]>;

  getStats(flightId: number): Promise<FlightStats[]>;

  deleteFlight(flightId: number): Promise<void>;
}