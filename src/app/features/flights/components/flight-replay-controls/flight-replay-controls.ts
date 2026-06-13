import { Component, computed, inject } from '@angular/core';

import { FlightDetailsStore } from '../../store/flight-details.store';

@Component({
  selector: 'app-flight-replay-controls',
  standalone: true,
  templateUrl: './flight-replay-controls.html',
  styleUrl: './flight-replay-controls.scss',
})
export class FlightReplayControls {
  readonly store = inject(FlightDetailsStore);

  readonly replaySpeeds = [1, 2, 5, 10, 20, 50] as const;

  readonly replayMinIndex = computed(() => {
    const range = this.getReplayRange();
    return range?.startIndex ?? 0;
  });

  readonly replayMaxIndex = computed(() => {
    const range = this.getReplayRange();
    return range?.endIndex ?? 0;
  });

  readonly sliderValue = computed(() => {
    const cursorIndex = this.store.cursorIndex();

    if (cursorIndex !== null) {
      return cursorIndex;
    }

    return this.replayMinIndex();
  });

  readonly hasReplayRange = computed(() => {
    return this.replayMaxIndex() > this.replayMinIndex();
  });

  startBackward(): void {
    this.store.startReplayBackward();
  }

  startForward(): void {
    this.store.startReplayForward();
  }

  toggleReplay(): void {
    this.store.toggleReplay();
  }

  setSpeed(speed: 1 | 2 | 5 | 10 | 20 | 50): void {
    this.store.setReplaySpeed(speed);
  }

  setSliderPosition(event: Event): void {
    const input = event.target as HTMLInputElement;
    const index = Number(input.value);

    if (!Number.isFinite(index)) {
      return;
    }

    this.store.setReplayCursor(index);
  }

  private getReplayRange(): { startIndex: number; endIndex: number } | null {
    const track = this.store.track();

    if (!track || track.timeSec.length === 0) {
      return null;
    }

    const selectedClimbId = this.store.selectedClimbId();

    if (this.store.showOnlySelectedClimbTrack() && selectedClimbId !== null) {
      const selectedClimb = this.store
        .climbs()
        .find((climb) => climb.id === selectedClimbId);

      if (selectedClimb) {
        return {
          startIndex: Math.max(
            0,
            Math.min(selectedClimb.startIndex, selectedClimb.endIndex),
          ),
          endIndex: Math.min(
            track.timeSec.length - 1,
            Math.max(selectedClimb.startIndex, selectedClimb.endIndex),
          ),
        };
      }
    }

    return {
      startIndex: 0,
      endIndex: track.timeSec.length - 1,
    };
  }
}