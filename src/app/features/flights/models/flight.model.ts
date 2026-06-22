export interface Flight {
  id: string; // SHA-256 of original IGC bytes

  fileName: string;
  flightDate?: string | null;
  pilot?: string | null;
  glider?: string | null;

  importedAtUtc: string;
}