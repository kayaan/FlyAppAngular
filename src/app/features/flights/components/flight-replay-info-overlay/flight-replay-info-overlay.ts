import { Component, input } from '@angular/core';

import { FlightDurationPipe } from '../../pipes/flight-duration.pipe';
import { FlightNumberPipe } from '../../pipes/flight-number.pipe';
import { FlightSignedNumberPipe } from '../../pipes/flight-signed-number.pipe';

export interface FlightReplayInfoOverlayData {
  index: number;
  maxIndex: number;
  relativeTimeSec: number;
  altitudeM: number;
  varioMs: number;
  speedKmh: number;
}

@Component({
  selector: 'app-flight-replay-info-overlay',
  standalone: true,
  imports: [
    FlightDurationPipe,
    FlightNumberPipe,
    FlightSignedNumberPipe,
  ],
  templateUrl: './flight-replay-info-overlay.html',
  styleUrl: './flight-replay-info-overlay.scss',
})
export class FlightReplayInfoOverlay {
  readonly info = input.required<FlightReplayInfoOverlayData>();
}