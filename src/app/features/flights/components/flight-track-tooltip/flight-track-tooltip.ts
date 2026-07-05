import { Component, computed, inject } from '@angular/core';

import { FlightDetailsStore } from '../../store/flight-details.store';

@Component({
  selector: 'app-flight-track-tooltip',
  standalone: true,
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

  formatReplayTime(totalSeconds: number): string {
    const safeSeconds = Math.max(0, Math.floor(totalSeconds));

    const hours = Math.floor(safeSeconds / 3600);
    const minutes = Math.floor((safeSeconds % 3600) / 60);
    const seconds = safeSeconds % 60;

    return [
      hours.toString().padStart(2, '0'),
      minutes.toString().padStart(2, '0'),
      seconds.toString().padStart(2, '0'),
    ].join(':');
  }

  formatNumber(value: number, digits: number): string {
    return value.toFixed(digits);
  }

  formatSignedNumber(value: number, digits: number): string {
    const sign = value > 0 ? '+' : '';

    return `${sign}${value.toFixed(digits)}`;
  }
}