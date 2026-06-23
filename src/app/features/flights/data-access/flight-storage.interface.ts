import { Flight } from '../models/flight.model';
import { FlightStats } from '../models/flight-stats.model';
import { TrackArrays } from '../models/track-arrays.model';
import { IgcFile } from '../models/igc-file.model';

export type NewFlight = Flight;
export type NewFlightStats = FlightStats;

export interface LocalFlightListItem {
  flight: Flight;
  stats: FlightStats | null;
}

export interface NewFlightImport {
  flight: NewFlight;
  track: TrackArrays;
  stats: NewFlightStats;
  igcFile: IgcFile;
}

export interface FlightDetails {
  flight: Flight;
  track: TrackArrays | undefined;
  stats: FlightStats | undefined;
  igcFile: IgcFile | undefined;
}

export interface FlightStorage {
  getFlightListItems(): Promise<LocalFlightListItem[]>;

  getFlights(): Promise<Flight[]>;
  getFlight(flightId: string): Promise<Flight | undefined>;
  getFlightDetails(flightId: string): Promise<FlightDetails | undefined>;

  existsFlight(flightId: string): Promise<boolean>;

  saveFlight(flight: NewFlight): Promise<string>;
  saveTrack(flightId: string, track: TrackArrays): Promise<void>;
  saveStats(stats: NewFlightStats): Promise<string>;
  saveIgcFile(igcFile: IgcFile): Promise<void>;

  saveCompleteImport(importData: NewFlightImport): Promise<string>;

  getTrack(flightId: string): Promise<TrackArrays | undefined>;
  getStats(flightId: string): Promise<FlightStats | undefined>;
  getIgcFile(flightId: string): Promise<IgcFile | undefined>;

  deleteFlight(flightId: string): Promise<void>;
}