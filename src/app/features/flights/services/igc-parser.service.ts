import { Injectable } from '@angular/core';

import { TrackArrays } from '../models/track-arrays.model';

export interface IgcMeta {
  pilot?: string;
  glider?: string;
  date?: string;
}

export interface ParsedIgcFile {
  track: TrackArrays;
  meta: IgcMeta;
}

@Injectable({
  providedIn: 'root',
})
export class IgcParserService {
  parse(igcText: string): ParsedIgcFile {
    const timeSec: number[] = [];
    const latE7: number[] = [];
    const lonE7: number[] = [];
    const altGpsCm: number[] = [];
    const altBaroCm: number[] = [];

    let pilot: string | undefined;
    let glider: string | undefined;
    let date: string | undefined;

    const lines = igcText.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();

      if (!line) {
        continue;
      }

      // Date: HFDTE010625 -> 2025-06-01
      if (line.startsWith('HFDTE')) {
        date = this.parseDate(line);
        continue;
      }

      // Pilot examples:
      // HFPLTPILOT:Max Mustermann
      // HFPLTPILOTINCHARGE:Max Mustermann
      if (line.startsWith('HFPLTPILOT:')) {
        pilot = this.cleanHeaderValue(line.substring('HFPLTPILOT:'.length));
        continue;
      }

      if (line.startsWith('HFPLTPILOTINCHARGE:')) {
        pilot = this.cleanHeaderValue(
          line.substring('HFPLTPILOTINCHARGE:'.length)
        );
        continue;
      }

      // Glider examples:
      // HFGTYGLIDERTYPE:Advance Sigma
      // HFGIDGLIDERID:D-1234
      if (line.startsWith('HFGTYGLIDERTYPE:')) {
        glider = this.cleanHeaderValue(
          line.substring('HFGTYGLIDERTYPE:'.length)
        );
        continue;
      }

      if (line.startsWith('HFGIDGLIDERID:') && !glider) {
        glider = this.cleanHeaderValue(line.substring('HFGIDGLIDERID:'.length));
        continue;
      }

      if (!line.startsWith('B')) {
        continue;
      }

      const fix = this.parseBRecord(line);

      if (!fix) {
        continue;
      }

      timeSec.push(fix.timeSec);
      latE7.push(fix.latE7);
      lonE7.push(fix.lonE7);
      altGpsCm.push(fix.altGpsCm);
      altBaroCm.push(fix.altBaroCm);
    }

    const track: TrackArrays = {
      timeSec: new Int32Array(timeSec),
      latE7: new Int32Array(latE7),
      lonE7: new Int32Array(lonE7),
      altGpsCm: new Int32Array(altGpsCm),
      altBaroCm: new Int32Array(altBaroCm),
    };

    return {
      track,
      meta: {
        pilot,
        glider,
        date,
      },
    };
  }

  private parseBRecord(line: string):
    | {
      timeSec: number;
      latE7: number;
      lonE7: number;
      altGpsCm: number;
      altBaroCm: number;
    }
    | null {
    // IGC B-record:
    // BHHMMSSDDMMmmmNDDDMMmmmEAaaaaabbbbb
    // Beispiel:
    // B0951293746220N03004882EA018590189708

    if (line.length < 35) {
      return null;
    }

    const hh = Number(line.substring(1, 3));
    const mm = Number(line.substring(3, 5));
    const ss = Number(line.substring(5, 7));

    if (!Number.isFinite(hh) || !Number.isFinite(mm) || !Number.isFinite(ss)) {
      return null;
    }

    const lat = this.parseLatitude(line.substring(7, 14));
    const ns = line.substring(14, 15);

    const lon = this.parseLongitude(line.substring(15, 23));
    const ew = line.substring(23, 24);

    const validity = line.substring(24, 25);

    const baroAltM = Number(line.substring(25, 30));
    const gpsAltM = Number(line.substring(30, 35));

    if (
      lat == null ||
      lon == null ||
      !Number.isFinite(baroAltM) ||
      !Number.isFinite(gpsAltM) ||
      (ns !== 'N' && ns !== 'S') ||
      (ew !== 'E' && ew !== 'W') ||
      validity !== 'A'
    ) {
      return null;
    }

    const signedLat = ns === 'S' ? -lat : lat;
    const signedLon = ew === 'W' ? -lon : lon;

    return {
      timeSec: hh * 3600 + mm * 60 + ss,
      latE7: Math.round(signedLat * 10_000_000),
      lonE7: Math.round(signedLon * 10_000_000),
      altGpsCm: Math.round(gpsAltM * 100),
      altBaroCm: Math.round(baroAltM * 100),
    };
  }

  private parseLatitude(value: string): number | null {
    // DDMMmmm = 7 Zeichen
    // Beispiel: 3746220 = 37°46.220'

    if (value.length !== 7) {
      return null;
    }

    const degrees = Number(value.substring(0, 2));
    const minutes = Number(value.substring(2, 4));
    const millis = Number(value.substring(4, 7));

    if (
      !Number.isFinite(degrees) ||
      !Number.isFinite(minutes) ||
      !Number.isFinite(millis)
    ) {
      return null;
    }

    return degrees + (minutes + millis / 1000) / 60;
  }

  private parseLongitude(value: string): number | null {
    // DDDMMmmm = 8 Zeichen
    // Beispiel: 03004882 = 30°04.882'

    if (value.length !== 8) {
      return null;
    }

    const degrees = Number(value.substring(0, 3));
    const minutes = Number(value.substring(3, 5));
    const millis = Number(value.substring(5, 8));

    if (
      !Number.isFinite(degrees) ||
      !Number.isFinite(minutes) ||
      !Number.isFinite(millis)
    ) {
      return null;
    }

    return degrees + (minutes + millis / 1000) / 60;
  }

  private parseDate(line: string): string | undefined {
    // Unterstützt:
    // HFDTE010625
    // HFDTEDATE:010625
    // HFDTE010625,01

    const match = line.match(/^HFDTE(?:DATE:)?(\d{6})/);

    if (!match) {
      return undefined;
    }

    const raw = match[1]; // ddmmyy

    const day = raw.substring(0, 2);
    const month = raw.substring(2, 4);
    const year = raw.substring(4, 6);

    const dayNumber = Number(day);
    const monthNumber = Number(month);
    const yearNumber = Number(year);

    if (
      !Number.isFinite(dayNumber) ||
      !Number.isFinite(monthNumber) ||
      !Number.isFinite(yearNumber) ||
      dayNumber < 1 ||
      dayNumber > 31 ||
      monthNumber < 1 ||
      monthNumber > 12
    ) {
      return undefined;
    }

    const fullYear = yearNumber >= 80 ? `19${year}` : `20${year}`;

    return `${fullYear}-${month}-${day}`;
  }

  private cleanHeaderValue(value: string): string | undefined {
    const cleaned = value.trim();

    if (!cleaned) {
      return undefined;
    }

    return cleaned;
  }
}