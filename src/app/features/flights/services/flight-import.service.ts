import { Injectable, inject } from '@angular/core';

import { IgcParserService } from './igc-parser.service';
import { FlightStatsCalculatorService } from './flight-stats-calculator.service';
import { ClimbDetectorService } from './climb-detector.service';

import { TrackArrays } from '../models/track-arrays.model';
import { CalculatedFlightStats } from '../models/calculated-flight-stats.model';
import { DetectedClimb } from '../models/detected-climb.model';

export interface FlightImportAnalysisResult {
  fileName: string;
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

  /**
   * Imports and analyzes an IGC file.
   *
   * This service does not save anything yet.
   * It only parses the file and calculates analysis data.
   */
  async analyzeFile(file: File): Promise<FlightImportAnalysisResult> {
    const igcText = await file.text();

    const track = this.igcParser.parse(igcText);
    const stats = this.statsCalculator.calculate(track);
    const climbs = this.climbDetector.detectClimbs(track);

    return {
      fileName: file.name,
      track,
      stats,
      climbs,
    };
  }
}