import { Injectable, inject } from '@angular/core';

import { IgcParserService } from './igc-parser.service';
import { FlightStatsCalculatorService } from './flight-stats-calculator.service';
import { ClimbDetectorService } from './climb-detector.service';
import { FileHashService } from './file-hash.service';

import { TrackArrays } from '../models/track-arrays.model';
import { CalculatedFlightStats } from '../models/calculated-flight-stats.model';
import { DetectedClimb } from '../models/detected-climb.model';

export interface FlightImportMeta {
  pilot?: string;
  glider?: string;
  date?: string;
}

export interface FlightImportAnalysisResult {
  fileName: string;
  fileHash: string;

  meta: FlightImportMeta;

  track: TrackArrays;
  stats: CalculatedFlightStats;
  climbs: DetectedClimb[];
}

@Injectable({
  providedIn: 'root',
})
export class FlightImportService {
  private readonly igcParser = inject(IgcParserService);
  private readonly statsCalculator = inject(FlightStatsCalculatorService);
  private readonly climbDetector = inject(ClimbDetectorService);
  private readonly fileHashService = inject(FileHashService);

  /**
   * Imports and analyzes one IGC file.
   *
   * This service does not save anything.
   * It only:
   * - calculates the file hash
   * - reads the IGC text
   * - parses track + metadata
   * - calculates flight stats
   * - detects climbs
   */
  async analyzeFile(file: File): Promise<FlightImportAnalysisResult> {
    const fileHash = await this.fileHashService.calculateFileHash(file);
    const igcText = await file.text();

    const parsed = this.igcParser.parse(igcText);

    const stats = this.statsCalculator.calculate(parsed.track);
    const climbs = this.climbDetector.detectClimbs(parsed.track);

    return {
      fileName: file.name,
      fileHash,

      meta: parsed.meta,

      track: parsed.track,
      stats,
      climbs,
    };
  }
}