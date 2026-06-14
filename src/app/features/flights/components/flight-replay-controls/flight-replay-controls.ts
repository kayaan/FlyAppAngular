import { Component, computed, inject, OnDestroy } from '@angular/core';

import { FlightDetailsStore } from '../../store/flight-details.store';

const REPLAY_TICK_MS = 100;

@Component({
  selector: 'app-flight-replay-controls',
  standalone: true,
  templateUrl: './flight-replay-controls.html',
  styleUrl: './flight-replay-controls.scss',
})
export class FlightReplayControls implements OnDestroy {
  readonly store = inject(FlightDetailsStore);

  private replayTimerId: number | null = null;
  private lastTickRealMs = 0;

  readonly speedOptions = [1, 2, 5, 10, 20, 50, 100];

  private isDraggingSlider = false;

  readonly replaySpeedValue = computed(() => {
    return String(this.store.replay().speed ?? 1);
  });

  readonly replayDirection = computed(() => {
    return this.store.replay().direction;
  });
  
  readonly maxIndex = computed(() => {
    const track = this.store.track();
    return track ? Math.max(0, track.timeSec.length - 1) : 0;
  });

  readonly replayIndex = computed(() => {
    return this.store.replay().index ?? 0;
  });

  readonly replayActive = computed(() => {
    return this.store.replay().active;
  });

  readonly replayPaused = computed(() => {
    return this.store.replay().paused;
  });

  readonly replaySpeed = computed(() => {
    return this.store.replay().speed;
  });

  readonly hasTrack = computed(() => {
    const track = this.store.track();
    return !!track && track.timeSec.length > 0;
  });

  onSliderPointerDown(): void {
    this.isDraggingSlider = true;
  }

  onSliderInput(): void {
    // intentionally empty:
    // store replay.index is updated only on slider commit/release
  }
  onSliderCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const index = Number(input.value);

    this.isDraggingSlider = false;

    this.store.setReplayIndex(index);

    if (this.store.replay().active && !this.store.replay().paused) {
      this.lastTickRealMs = performance.now();
    }
  }


  private startTimerFromCurrentIndex(): void {
    const track = this.store.track();

    if (!track || track.timeSec.length === 0) {
      return;
    }

    this.stopTimer();

    this.lastTickRealMs = performance.now();

    this.replayTimerId = window.setInterval(() => {
      this.tickReplay();
    }, REPLAY_TICK_MS);
  }

  playForward(): void {
    const replay = this.store.replay();

    if (!replay.active) {
      this.store.playReplayForward();
      this.startTimerFromCurrentIndex();
      return;
    }

    if (replay.paused || replay.direction !== 1) {
      this.store.playReplayForward();
      this.startTimerFromCurrentIndex();
    }
  }

  playBackward(): void {
    const replay = this.store.replay();

    if (!replay.active) {
      this.store.playReplayBackward();
      this.startTimerFromCurrentIndex();
      return;
    }

    if (replay.paused || replay.direction !== -1) {
      this.store.playReplayBackward();
      this.startTimerFromCurrentIndex();
    }
  }

  pause(): void {
    this.stopTimer();
    this.store.pauseReplay();
  }

  stop(): void {
    this.stopTimer();
    this.store.stopReplay();
  }

  private tickReplay(): void {
    const track = this.store.track();
    const replay = this.store.replay();

    if (!track || track.timeSec.length === 0 || !replay.active || replay.paused) {
      this.stopTimer();
      return;
    }

    if (this.isDraggingSlider) {
      this.lastTickRealMs = performance.now();
      return;
    }

    const currentIndex = replay.index ?? 0;
    const lastIndex = track.timeSec.length - 1;

    if (replay.direction === 1 && currentIndex >= lastIndex) {
      this.store.setReplayIndex(lastIndex);
      this.stopTimer();
      this.store.pauseReplay();
      return;
    }

    if (replay.direction === -1 && currentIndex <= 0) {
      this.store.setReplayIndex(0);
      this.stopTimer();
      this.store.pauseReplay();
      return;
    }

    const now = performance.now();
    const deltaRealSec = (now - this.lastTickRealMs) / 1000;
    this.lastTickRealMs = now;

    const deltaReplaySec = deltaRealSec * replay.speed * replay.direction;

    const currentFlightSec = track.timeSec[currentIndex];
    const targetFlightSec = currentFlightSec + deltaReplaySec;

    const firstFlightSec = track.timeSec[0];
    const lastFlightSec = track.timeSec[lastIndex];

    if (targetFlightSec >= lastFlightSec) {
      this.store.setReplayIndex(lastIndex);
      this.stopTimer();
      this.store.pauseReplay();
      return;
    }

    if (targetFlightSec <= firstFlightSec) {
      this.store.setReplayIndex(0);
      this.stopTimer();
      this.store.pauseReplay();
      return;
    }

    const targetIndex =
      replay.direction === 1
        ? this.findIndexByTime(track.timeSec, targetFlightSec)
        : this.findIndexByTimeReverse(track.timeSec, targetFlightSec);

    this.store.setReplayIndex(targetIndex);
  }

  private findIndexByTimeReverse(
    timeSec: Int32Array,
    targetFlightSec: number
  ): number {
    if (timeSec.length === 0) {
      return 0;
    }

    if (targetFlightSec <= timeSec[0]) {
      return 0;
    }

    if (targetFlightSec >= timeSec[timeSec.length - 1]) {
      return timeSec.length - 1;
    }

    let low = 0;
    let high = timeSec.length - 1;

    while (low < high) {
      const mid = Math.ceil((low + high) / 2);

      if (timeSec[mid] > targetFlightSec) {
        high = mid - 1;
      } else {
        low = mid;
      }
    }

    return low;
  }

  private stopTimer(): void {
    if (this.replayTimerId === null) {
      return;
    }

    window.clearInterval(this.replayTimerId);
    this.replayTimerId = null;
  }

  onSpeedChange(event: Event): void {
    const select = event.target as HTMLSelectElement;

    this.store.setReplaySpeed(Number(select.value));

    if (this.store.replay().active && !this.store.replay().paused) {
      this.lastTickRealMs = performance.now();
    }
  }

  private findIndexByTime(timeSec: Int32Array, targetFlightSec: number): number {
    if (timeSec.length === 0) {
      return 0;
    }

    if (targetFlightSec <= timeSec[0]) {
      return 0;
    }

    let low = 0;
    let high = timeSec.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);

      if (timeSec[mid] < targetFlightSec) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }
}