import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class FileHashService {
  /**
   * Calculates a SHA-256 hash for a file.
   *
   * We use this to detect duplicate IGC imports.
   */
  async calculateFileHash(file: File): Promise<string> {
    const buffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);

    return this.toHex(hashBuffer);
  }

  /**
   * Converts an ArrayBuffer into a hexadecimal string.
   */
  private toHex(buffer: ArrayBuffer): string {
    return Array.from(new Uint8Array(buffer))
      .map((byte) => byte.toString(16).padStart(2, '0'))
      .join('');
  }
}