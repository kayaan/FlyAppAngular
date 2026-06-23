export interface IgcFile {
  id: string; // same as Flight.id = SHA-256(original IGC bytes)
  fileName: string;
  content: string; // original IGC text
  sizeBytes: number;
  createdAtUtc: string;
}