import { Injectable } from '@angular/core';
import { TrackArrays } from '../models/track-arrays.model';

@Injectable({
  providedIn: 'root',
})
export class IgcParserService {
  /**
   * Parses raw IGC file content and converts it into TrackArrays.
   *
   * For now we only parse B-records:
   * BHHMMSSDDMMmmmNDDDMMmmmEAaaaaGgggg
   *
   * Example:
   * B1234564807123N00912345EA0123401234
   */
  parse(igcText: string): TrackArrays {
    const timeSec: number[] = [];
    const latE7: number[] = [];
    const lonE7: number[] = [];
    const altBaroCm: number[] = [];
    const altGpsCm: number[] = [];

    const lines = igcText.split(/\r?\n/);

    for (const line of lines) {
      // B-records contain GPS fix data.
      if (!line.startsWith('B')) {
        continue;
      }

      // Ignore invalid or too short B-records.
      if (line.length < 35) {
        continue;
      }

      const parsed = this.parseBRecord(line);

      if (!parsed) {
        continue;
      }

      timeSec.push(parsed.timeSec);
      latE7.push(parsed.latE7);
      lonE7.push(parsed.lonE7);
      altBaroCm.push(parsed.altBaroCm);
      altGpsCm.push(parsed.altGpsCm);
    }

    return {
      timeSec: new Int32Array(timeSec),
      latE7: new Int32Array(latE7),
      lonE7: new Int32Array(lonE7),
      altBaroCm: new Int32Array(altBaroCm),
      altGpsCm: new Int32Array(altGpsCm),
    };
  }

  /**
   * Parses one IGC B-record.
   *
   * Format:
   * B HHMMSS DDMMmmm N DDDMMmmm E A aaaaa ggggg
   */
  private parseBRecord(line: string): ParsedFix | null {
    try {
      const hour = Number(line.substring(1, 3));
      const minute = Number(line.substring(3, 5));
      const second = Number(line.substring(5, 7));

      const latDeg = Number(line.substring(7, 9));
      const latMin = Number(line.substring(9, 14)) / 1000;
      const latHemisphere = line.substring(14, 15);

      const lonDeg = Number(line.substring(15, 18));
      const lonMin = Number(line.substring(18, 23)) / 1000;
      const lonHemisphere = line.substring(23, 24);

      const validity = line.substring(24, 25);

      const baroAltM = Number(line.substring(25, 30));
      const gpsAltM = Number(line.substring(30, 35));

      // Only accept valid GPS fixes.
      if (validity !== 'A') {
        return null;
      }

      if (
        Number.isNaN(hour) ||
        Number.isNaN(minute) ||
        Number.isNaN(second) ||
        Number.isNaN(latDeg) ||
        Number.isNaN(latMin) ||
        Number.isNaN(lonDeg) ||
        Number.isNaN(lonMin) ||
        Number.isNaN(baroAltM) ||
        Number.isNaN(gpsAltM)
      ) {
        return null;
      }

      let lat = latDeg + latMin / 60;
      let lon = lonDeg + lonMin / 60;

      if (latHemisphere === 'S') {
        lat *= -1;
      }

      if (lonHemisphere === 'W') {
        lon *= -1;
      }

      return {
        timeSec: hour * 3600 + minute * 60 + second,

        // Store coordinates as integer degrees * 10,000,000.
        // This is more compact and avoids floating point drift in storage.
        latE7: Math.round(lat * 10_000_000),
        lonE7: Math.round(lon * 10_000_000),

        // Store altitude in centimeters for integer-based calculations.
        altBaroCm: baroAltM * 100,
        altGpsCm: gpsAltM * 100,
      };
    } catch {
      return null;
    }
  }
}

interface ParsedFix {
  timeSec: number;
  latE7: number;
  lonE7: number;
  altBaroCm: number;
  altGpsCm: number;
}