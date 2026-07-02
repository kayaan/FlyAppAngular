export interface PublicFlight {
  id: string;
  fileName: string;
  flightDate: string | null;
  pilot: string | null;
  glider: string | null;
  importedAtUtc: string;

  startIndex: number;
  endIndex: number;
  fixCount: number;

  startTimeSec: number;
  endTimeSec: number;
  durationSec: number;

  distanceM: number;

  minAltGpsM: number;
  maxAltGpsM: number;
  gainGpsM: number;

  minAltBaroM: number;
  maxAltBaroM: number;
  gainBaroM: number;

  minLatE7: number | null;
  maxLatE7: number | null;
  minLonE7: number | null;
  maxLonE7: number | null;

  startLatE7: number | null;
  startLonE7: number | null;
  endLatE7: number | null;
  endLonE7: number | null;
}

export interface PublicFlightsPage {
  items: PublicFlight[];
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export interface PublicFlightDetailsDto {
  flight: PublicFlight;
  track: PublicTrackDto;
}

export interface PublicTrackDto {
  timeSec: number[];
  latE7: number[];
  lonE7: number[];
  altGpsCm: number[];
  altBaroCm: number[];
}