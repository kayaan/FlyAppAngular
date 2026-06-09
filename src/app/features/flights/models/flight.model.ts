export interface Flight {
  id: number;

  fileName: string;
  fileHash: string;

  pilotName?: string;
  gliderType?: string;
  date?: string;

  importedAtUtc: string;
}