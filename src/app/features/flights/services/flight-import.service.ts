import { Injectable, inject } from '@angular/core';

import { IgcParserService } from './igc-parser.service';
import { FlightStatsCalculatorService } from '../domain/flight-stats-calculator.service';
import { FileHashService } from './file-hash.service';

import { TrackArrays } from '../models/track-arrays.model';
import { CalculatedFlightStats } from '../models/calculated-flight-stats.model';

export interface FlightImportMeta {
  pilot?: string;
  glider?: string;
  date?: string;
}

export interface FlightImportAnalysisResult {
  id: string; // SHA-256 of original IGC bytes

  fileName: string;

  meta: FlightImportMeta;

  track: TrackArrays;
  stats: CalculatedFlightStats;
}

@Injectable({
  providedIn: 'root',
})
export class FlightImportService {
  private readonly igcParser = inject(IgcParserService);
  private readonly statsCalculator = inject(FlightStatsCalculatorService);
  private readonly fileHashService = inject(FileHashService);

  async analyzeFile(file: File): Promise<FlightImportAnalysisResult> {
    const id = await this.fileHashService.calculateFileHash(file);
    const igcText = await file.text();

    const parsed = this.igcParser.parse(igcText);

    const stats = this.statsCalculator.calculate(parsed.track);

    return {
      id,
      fileName: file.name,

      meta: parsed.meta,

      track: parsed.track,
      stats,
    };
  }
}