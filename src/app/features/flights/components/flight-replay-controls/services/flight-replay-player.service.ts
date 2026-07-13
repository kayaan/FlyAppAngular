import { Injectable, inject } from '@angular/core';

import { FlightDetailsStore } from '../../../store/flight-details.store';

const REPLAY_TICK_MS = 100;

@Injectable()
export class FlightReplayPlayerService {
  private readonly store = inject(FlightDetailsStore);

  private replayFlightTimeSec: number | null = null;
  private replayTimerId: number | null = null;
  private lastTickRealMs = 0;
  private draggingSlider = false;

  setDraggingSlider(dragging: boolean): void {
    this.draggingSlider = dragging;
  }

  syncWithIndex(index: number): void {
    const track = this.store.track();

    if (track && index >= 0 && index < track.timeSec.length) {
      this.replayFlightTimeSec = track.timeSec[index];
    }

    this.resetTickTime();
  }

  resetTickTime(): void {
    if (this.store.replay().active && !this.store.replay().paused) {
      this.lastTickRealMs = performance.now();
    }
  }

  start(): void {
    const track = this.store.track();

    if (!track || track.timeSec.length === 0) {
      return;
    }

    this.stopTimer();

    const replay = this.store.replay();
    const startIndex = replay.range?.startIndex ?? 0;
    const endIndex = replay.range?.endIndex ?? track.timeSec.length - 1;
    const currentIndex = replay.index ?? startIndex;

    const safeIndex = Math.max(
      startIndex,
      Math.min(currentIndex, endIndex)
    );

    this.replayFlightTimeSec = track.timeSec[safeIndex];
    this.lastTickRealMs = performance.now();

    this.replayTimerId = window.setInterval(() => {
      this.tick();
    }, REPLAY_TICK_MS);
  }

  stop(): void {
    this.stopTimer();
    this.replayFlightTimeSec = null;
  }

  destroy(): void {
    this.stop();
  }

  private tick(): void {
    const track = this.store.track();
    const replay = this.store.replay();

    if (
      !track ||
      track.timeSec.length === 0 ||
      !replay.active ||
      replay.paused
    ) {
      this.stopTimer();
      return;
    }

    if (this.draggingSlider) {
      this.lastTickRealMs = performance.now();
      return;
    }

    const lastTrackIndex = track.timeSec.length - 1;

    const startIndex = Math.max(
      0,
      Math.min(replay.range?.startIndex ?? 0, lastTrackIndex)
    );

    const endIndex = Math.max(
      startIndex,
      Math.min(
        replay.range?.endIndex ?? lastTrackIndex,
        lastTrackIndex
      )
    );

    const currentIndex = Math.max(
      startIndex,
      Math.min(replay.index ?? startIndex, endIndex)
    );

    if (replay.direction === 1 && currentIndex >= endIndex) {
      this.finishAt(endIndex, track.timeSec[endIndex]);
      return;
    }

    if (replay.direction === -1 && currentIndex <= startIndex) {
      this.finishAt(startIndex, track.timeSec[startIndex]);
      return;
    }

    const now = performance.now();
    const deltaRealSec = (now - this.lastTickRealMs) / 1000;

    this.lastTickRealMs = now;

    if (this.replayFlightTimeSec === null) {
      this.replayFlightTimeSec = track.timeSec[currentIndex];
    }

    const firstFlightSec = track.timeSec[startIndex];
    const lastFlightSec = track.timeSec[endIndex];

    if (
      this.replayFlightTimeSec < firstFlightSec ||
      this.replayFlightTimeSec > lastFlightSec
    ) {
      this.replayFlightTimeSec = track.timeSec[currentIndex];
      return;
    }

    const targetFlightSec =
      this.replayFlightTimeSec +
      deltaRealSec * replay.speed * replay.direction;

    if (targetFlightSec >= lastFlightSec) {
      this.finishAt(endIndex, lastFlightSec);
      return;
    }

    if (targetFlightSec <= firstFlightSec) {
      this.finishAt(startIndex, firstFlightSec);
      return;
    }

    this.replayFlightTimeSec = targetFlightSec;

    const targetIndex =
      replay.direction === 1
        ? this.findIndexByTime(track.timeSec, targetFlightSec)
        : this.findIndexByTimeReverse(track.timeSec, targetFlightSec);

    this.store.setReplayIndex(
      Math.max(startIndex, Math.min(targetIndex, endIndex))
    );
  }

  private finishAt(index: number, flightTimeSec: number): void {
    this.replayFlightTimeSec = flightTimeSec;
    this.store.setReplayIndex(index);
    this.stopTimer();
    this.store.pauseReplay();
  }

  private stopTimer(): void {
    if (this.replayTimerId === null) {
      return;
    }

    window.clearInterval(this.replayTimerId);
    this.replayTimerId = null;
  }

  private findIndexByTime(
    timeSec: Int32Array,
    targetFlightSec: number
  ): number {
    if (timeSec.length === 0 || targetFlightSec <= timeSec[0]) {
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

  private findIndexByTimeReverse(
    timeSec: Int32Array,
    targetFlightSec: number
  ): number {
    if (timeSec.length === 0 || targetFlightSec <= timeSec[0]) {
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
}