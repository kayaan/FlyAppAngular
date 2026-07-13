import {
  Component,
  computed,
  inject,
  OnDestroy,
} from '@angular/core';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightReplayPlayerService } from './services/flight-replay-player.service';

const PRESET_TRAIL_DURATIONS = [60, 120, 300] as const;

@Component({
  selector: 'app-flight-replay-controls',
  standalone: true,
  templateUrl: './flight-replay-controls.html',
  styleUrl: './flight-replay-controls.scss',
  providers: [FlightReplayPlayerService],
})
export class FlightReplayControls implements OnDestroy {
  readonly store = inject(FlightDetailsStore);

  private readonly player = inject(
    FlightReplayPlayerService
  );

  readonly speedOptions = [
    1,
    2,
    5,
    10,
    20,
    50,
    100,
  ];

  readonly vm = computed(() => {
    const replay = this.store.replay();
    const track = this.store.track();

    const lastIndex = track
      ? Math.max(0, track.timeSec.length - 1)
      : 0;

    const trailDurationSec =
      replay.replayTrailDurationSec;

    const trailDurationValue =
      trailDurationSec === null
        ? 'full'
        : PRESET_TRAIL_DURATIONS.includes(
          trailDurationSec as 60 | 120 | 300
        )
          ? String(trailDurationSec)
          : 'custom';

    return {
      active: replay.active,
      paused: replay.paused,
      direction: replay.direction,

      rawIndex: replay.index,
      index: replay.index ?? 0,

      minIndex: replay.range?.startIndex ?? 0,
      maxIndex: replay.range?.endIndex ?? lastIndex,
      speed: replay.speed,
      speedValue: String(replay.speed ?? 1),
      hasTrack: !!track && track.timeSec.length > 0,
      cameraFollowEnabled: replay.cameraFollowEnabled,
      trailDurationValue,
      showCustomTrailDuration:
        trailDurationValue === 'custom',
      customTrailDurationSec:
        trailDurationSec ?? 60,
    };
  });

  onSliderPointerDown(): void {
    this.player.setDraggingSlider(true);
  }

  onSliderInput(): void {
    // Intentionally empty:
    // replay.index is updated only when the slider
    // is committed or released.
  }

  onSliderCommit(event: Event): void {
    const input = event.target as HTMLInputElement;
    const index = Number(input.value);

    this.player.setDraggingSlider(false);

    this.store.setReplayIndex(index);
    this.player.syncWithIndex(index);
  }

  playForward(): void {
    const replay = this.store.replay();

    if (
      !replay.active ||
      replay.paused ||
      replay.direction !== 1
    ) {
      this.store.playReplayForward();
      this.player.start();
    }
  }

  playBackward(): void {
    const replay = this.store.replay();

    if (
      !replay.active ||
      replay.paused ||
      replay.direction !== -1
    ) {
      this.store.playReplayBackward();
      this.player.start();
    }
  }

  pause(): void {
    this.player.stop();
    this.store.pauseReplay();
  }

  stop(): void {
    this.player.stop();
    this.store.stopReplay();
  }

  toggleCameraFollow(event: Event): void {
    const checked = (
      event.target as HTMLInputElement
    ).checked;

    this.store.setReplayCameraFollowEnabled(
      checked
    );
  }

  onTrailDurationChange(event: Event): void {
    const value = (
      event.target as HTMLSelectElement
    ).value;

    if (value === 'full') {
      this.store.setReplayTrailDurationSec(null);
      return;
    }

    if (value === 'custom') {
      const current =
        this.store.replay().replayTrailDurationSec;

      if (
        current === null ||
        current === 60 ||
        current === 120 ||
        current === 300
      ) {
        this.store.setReplayTrailDurationSec(180);
      }

      return;
    }

    this.store.setReplayTrailDurationSec(
      Number(value)
    );
  }

  onCustomTrailDurationChange(
    event: Event
  ): void {
    const value = Number(
      (event.target as HTMLInputElement).value
    );

    if (!Number.isFinite(value) || value <= 0) {
      return;
    }

    this.store.setReplayTrailDurationSec(value);
  }

  onSpeedChange(event: Event): void {
    const select =
      event.target as HTMLSelectElement;

    this.store.setReplaySpeed(
      Number(select.value)
    );

    this.player.resetTickTime();
  }

  ngOnDestroy(): void {
    this.player.destroy();
    this.store.stopReplay();
  }
}