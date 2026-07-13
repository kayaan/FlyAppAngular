import { Component, OnDestroy, inject, signal } from '@angular/core';
import { Subject, debounceTime, takeUntil } from 'rxjs';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';

const RESOLUTION_INPUT_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-flight-details-settings-drawer',
  standalone: true,
  templateUrl: './flight-details-settings-drawer.html',
  styleUrl: './flight-details-settings-drawer.scss',
})
export class FlightDetailsSettingsDrawer implements OnDestroy {
  readonly settingsStore = inject(FlightSettingsStore);

  readonly open = signal(false);

  private readonly detailsStore = inject(FlightDetailsStore);
  private readonly destroy$ = new Subject<void>();

  private readonly altitudeResolutionInput$ = new Subject<number>();
  private readonly varioResolutionInput$ = new Subject<number>();
  private readonly speedResolutionInput$ = new Subject<number>();

  constructor() {
    this.altitudeResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setAltitudeChartResolutionInSec(value);
        this.detailsStore.recalculateTrackMetrics();
      });

    this.varioResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setVarioChartResolutionInSec(value);
        this.detailsStore.recalculateTrackMetrics();
      });

    this.speedResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setSpeedChartResolutionInSec(value);
        this.detailsStore.recalculateTrackMetrics();
      });
  }

  openDrawer(): void {
    this.open.set(true);
  }

  closeDrawer(): void {
    this.open.set(false);
  }

  setAltitudeChartVisible(event: Event): void {
    this.settingsStore.setShowAltitudeChart(
      (event.target as HTMLInputElement).checked
    );
  }

  setVarioChartVisible(event: Event): void {
    this.settingsStore.setShowVarioChart(
      (event.target as HTMLInputElement).checked
    );
  }

  setSpeedChartVisible(event: Event): void {
    this.settingsStore.setShowSpeedChart(
      (event.target as HTMLInputElement).checked
    );
  }

  setAltitudeResolution(event: Event): void {
    this.altitudeResolutionInput$.next(
      Number((event.target as HTMLInputElement).value)
    );
  }

  setVarioResolution(event: Event): void {
    this.varioResolutionInput$.next(
      Number((event.target as HTMLInputElement).value)
    );
  }

  setSpeedResolution(event: Event): void {
    this.speedResolutionInput$.next(
      Number((event.target as HTMLInputElement).value)
    );
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }
}