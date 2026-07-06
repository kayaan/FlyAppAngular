import { Component, computed, inject } from '@angular/core';

import { FlightDurationPipe } from '../../pipes/flight-duration.pipe';
import { FlightNumberPipe } from '../../pipes/flight-number.pipe';
import { FlightSignedNumberPipe } from '../../pipes/flight-signed-number.pipe';
import { FlightDetailsStore } from '../../store/flight-details.store';

@Component({
  selector: 'app-flight-track-tooltip',
  standalone: true,
  imports: [
    FlightDurationPipe,
    FlightNumberPipe,
    FlightSignedNumberPipe,
  ],
  templateUrl: './flight-track-tooltip.html',
  styleUrl: './flight-track-tooltip.scss',
})
export class FlightTrackTooltip {
  private readonly store = inject(FlightDetailsStore);

  readonly tooltip = computed(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();
    const cursorIndex = this.store.cursorIndex();
    const replay = this.store.replay();

    if (!track || !metrics || replay.active || cursorIndex === null) {
      return null;
    }

    const index = Math.max(
      0,
      Math.min(
        cursorIndex,
        track.timeSec.length - 1,
        metrics.altitudeM.length - 1,
        metrics.varioMs.length - 1,
        metrics.speedKmh.length - 1
      )
    );

    return {
      index,
      relativeTimeSec: track.timeSec[index] - track.timeSec[0],
      altitudeM: metrics.altitudeM[index],
      varioMs: metrics.varioMs[index],
      speedKmh: metrics.speedKmh[index],
    };
  });
}