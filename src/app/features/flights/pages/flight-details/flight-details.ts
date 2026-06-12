import { Component, DestroyRef, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightMap } from '../../components/flight-map/flight-map';
import {
  FlightChartPoint,
  FlightLineChart,
} from '../../components/flight-line-chart/flight-line-chart';
import { FlightSummaryTags } from '../../components/flight-summary-tags/flight-summary-tags';
import { FlightSettingsStore } from '../../store/flight-settings.store';
import { TrackArrays } from '../../models/track-arrays.model';
import { debounceTime, Subject, takeUntil } from 'rxjs';
import { FlightClimbsPanel } from '../../components/flight-climbs-panel/flight-climbs-panel';

import { Flight3d } from '../../components/flight-3d/flight-3d';

const RESOLUTION_INPUT_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-flight-details',
  standalone: true,
  imports: [CommonModule, RouterLink, FlightLineChart, FlightMap, FlightSummaryTags, FlightClimbsPanel, Flight3d],
  templateUrl: './flight-details.html',
  styleUrl: './flight-details.scss',
  providers: [FlightDetailsStore],
})
export class FlightDetails implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  readonly store = inject(FlightDetailsStore);
  readonly settingsStore = inject(FlightSettingsStore);

  readonly settingsDrawerOpen = signal(false);

  private readonly destroy$ = new Subject<void>();

  private readonly altitudeResolutionInput$: Subject<number> = new Subject<number>();
  private readonly varioResolutionInput$: Subject<number> = new Subject<number>();
  private readonly speedResolutionInput$: Subject<number> = new Subject<number>();

  private readonly resolutionDebounceMs = 500;

  viewMode: 'map' | '3d' = 'map';

  setViewMode(mode: 'map' | '3d'): void {
    this.viewMode = mode;
  }

  constructor() {
    this.altitudeResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setAltitudeChartResolutionInSec(value);
      });

    this.varioResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setVarioChartResolutionInSec(value);
      });

    this.speedResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setSpeedChartResolutionInSec(value);
      });
  }

  readonly flightStats = computed(() =>
    this.store.stats().find((item) => item.scopeType === 'flight') ?? null
  );

  readonly trackPointCount = computed(() => this.store.track()?.timeSec.length ?? 0);

  ngOnInit(): void {
    const idParam = this.route.snapshot.paramMap.get('id');
    const flightId = Number(idParam);

    if (!Number.isFinite(flightId) || flightId <= 0) {
      return;
    }

    void this.store.loadFlight(flightId);
  }

  openSettingsDrawer(): void {
    this.settingsDrawerOpen.set(true);
  }

  closeSettingsDrawer(): void {
    this.settingsDrawerOpen.set(false);
  }

  setAltitudeChartVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settingsStore.setShowAltitudeChart(checked);
  }

  setVarioChartVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settingsStore.setShowVarioChart(checked);
  }

  setSpeedChartVisible(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.settingsStore.setShowSpeedChart(checked);
  }

  setAltitudeResolution(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.altitudeResolutionInput$.next(value);
  }

  setVarioResolution(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.varioResolutionInput$.next(value);
  }

  setSpeedResolution(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.speedResolutionInput$.next(value);
  }

  readonly altitudeData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();

    if (!track) {
      return [];
    }

    const resolutionSec = this.settingsStore.altitudeChartResolutionInSec();
    const result: FlightChartPoint[] = [];

    for (let i = 0; i < track.timeSec.length; i++) {
      result.push({
        index: i,
        timeSec: track.timeSec[i],
        value: this.averageAltitudeM(track, i, resolutionSec),
      });
    }

    return result;
  });

  readonly varioData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();

    if (!track) {
      return [];
    }

    const resolutionSec = this.settingsStore.varioChartResolutionInSec();
    const result: FlightChartPoint[] = [];

    for (let i = 0; i < track.timeSec.length; i++) {
      result.push({
        index: i,
        timeSec: track.timeSec[i],
        value: this.averageVarioMs(track, i, resolutionSec),
      });
    }

    return result;
  });

  readonly speedData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();

    if (!track) {
      return [];
    }

    const resolutionSec = this.settingsStore.speedChartResolutionInSec();
    const result: FlightChartPoint[] = [];

    for (let i = 0; i < track.timeSec.length; i++) {
      result.push({
        index: i,
        timeSec: track.timeSec[i],
        value: this.averageSpeedKmh(track, i, resolutionSec),
      });
    }

    return result;
  });


  private averageAltitudeM(
    track: TrackArrays,
    currentIndex: number,
    resolutionSec: number
  ): number {
    const currentTimeSec = track.timeSec[currentIndex];
    const fromTimeSec = currentTimeSec - resolutionSec;

    let sum = 0;
    let count = 0;

    for (let i = currentIndex; i >= 0; i--) {
      if (track.timeSec[i] < fromTimeSec) {
        break;
      }

      sum += track.altGpsCm[i] / 100;
      count++;
    }

    if (count === 0) {
      return track.altGpsCm[currentIndex] / 100;
    }

    return sum / count;
  }

  private averageVarioMs(
    track: TrackArrays,
    currentIndex: number,
    resolutionSec: number
  ): number {
    if (currentIndex === 0) {
      return 0;
    }

    const previousIndex = this.findPreviousIndexByResolution(
      track.timeSec,
      currentIndex,
      resolutionSec
    );

    const dtSec = track.timeSec[currentIndex] - track.timeSec[previousIndex];

    if (dtSec <= 0) {
      return 0;
    }

    const altitudeDiffM =
      (track.altGpsCm[currentIndex] - track.altGpsCm[previousIndex]) / 100;

    return altitudeDiffM / dtSec;
  }

  private averageSpeedKmh(
    track: TrackArrays,
    currentIndex: number,
    resolutionSec: number
  ): number {
    if (currentIndex === 0) {
      return 0;
    }

    const previousIndex = this.findPreviousIndexByResolution(
      track.timeSec,
      currentIndex,
      resolutionSec
    );

    const dtSec = track.timeSec[currentIndex] - track.timeSec[previousIndex];

    if (dtSec <= 0) {
      return 0;
    }

    let distanceM = 0;

    for (let i = previousIndex + 1; i <= currentIndex; i++) {
      distanceM += this.distanceMeters(
        track.latE7[i - 1] / 10_000_000,
        track.lonE7[i - 1] / 10_000_000,
        track.latE7[i] / 10_000_000,
        track.lonE7[i] / 10_000_000
      );
    }

    return (distanceM / dtSec) * 3.6;
  }

  private findPreviousIndexByResolution(
    timeSec: Int32Array,
    currentIndex: number,
    resolutionSec: number
  ): number {
    const safeResolutionSec = Math.max(1, Math.round(resolutionSec));
    const targetTimeSec = timeSec[currentIndex] - safeResolutionSec;

    for (let i = currentIndex - 1; i >= 0; i--) {
      if (timeSec[i] <= targetTimeSec) {
        return i;
      }
    }

    return 0;
  }

  private distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number {
    const earthRadiusM = 6_371_000;

    const phi1 = this.toRad(lat1);
    const phi2 = this.toRad(lat2);
    const deltaPhi = this.toRad(lat2 - lat1);
    const deltaLambda = this.toRad(lon2 - lon1);

    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return earthRadiusM * c;
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }

  formatDate(value: string | undefined | null): string {
    if (!value) return '—';

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return value;
    }

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(date);
  }

  formatDuration(durationSec: number | undefined | null): string {
    if (durationSec == null) return '—';

    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor((durationSec % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  formatDistance(distanceM: number | undefined | null): string {
    if (distanceM == null) return '—';

    return `${(distanceM / 1000).toFixed(1)} km`;
  }

  formatHeight(heightM: number | undefined | null): string {
    if (heightM == null) return '—';

    return `${Math.round(heightM)} m`;
  }

  formatSpeed(speedKmh: number | undefined | null): string {
    if (speedKmh == null) return '—';

    return `${Math.round(speedKmh)} km/h`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.store.clear();
  }
}

function takeUntilDestroyed(destroyRef: DestroyRef): import("rxjs").OperatorFunction<number, unknown> {
  throw new Error('Function not implemented.');
}
