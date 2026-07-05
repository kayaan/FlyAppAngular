import {
  Component,
  OnDestroy,
  OnInit,
  Type,
  computed,
  inject,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { debounceTime, Subject, takeUntil } from 'rxjs';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';

import { FlightMap } from '../../components/flight-map/flight-map';
import {
  FlightChartPoint,
  FlightLineChart,
} from '../../components/flight-line-chart/flight-line-chart';
import { FlightSummaryTags } from '../../components/flight-summary-tags/flight-summary-tags';
import { FlightClimbsPanel } from '../../components/flight-climbs-panel/flight-climbs-panel';
import { FlightReplayControls } from '../../components/flight-replay-controls/flight-replay-controls';
import { TrackColorMode } from '../../models/flight-settings.model';

const RESOLUTION_INPUT_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-flight-details',
  standalone: true,
  imports: [
    CommonModule,
    RouterLink,
    FlightLineChart,
    FlightMap,
    FlightSummaryTags,
    FlightClimbsPanel,
    FlightReplayControls,
  ],
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

  private readonly altitudeResolutionInput$ = new Subject<number>();
  private readonly varioResolutionInput$ = new Subject<number>();
  private readonly speedResolutionInput$ = new Subject<number>();

  readonly isPublicFlight = computed(
    () => this.route.snapshot.data['source'] === 'public'
  );

  readonly backLink = computed(() =>
    this.isPublicFlight() ? '/explore' : '/flights'
  );

  readonly backLabel = computed(() =>
    this.isPublicFlight()
      ? '← Back to public flights'
      : '← Back to flights'
  );

  viewMode: 'map' | '3d' = 'map';

  readonly flight3dComponent = signal<Type<unknown> | null>(null);

  readonly flightStats = computed(() => this.store.stats());

  readonly trackPointCount = computed(
    () => this.store.track()?.timeSec.length ?? 0
  );

  readonly altitudeData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();

    if (!track || !metrics) {
      return [];
    }

    return this.toChartPoints(track.timeSec, metrics.altitudeM);
  });

  readonly varioData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();

    if (!track || !metrics) {
      return [];
    }

    return this.toChartPoints(track.timeSec, metrics.varioMs);
  });

  readonly speedData = computed<FlightChartPoint[]>(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();

    if (!track || !metrics) {
      return [];
    }

    return this.toChartPoints(track.timeSec, metrics.speedKmh);
  });

  constructor() {
    this.altitudeResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setAltitudeChartResolutionInSec(value);
        this.store.recalculateTrackMetrics();
      });

    this.varioResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setVarioChartResolutionInSec(value);
        this.store.recalculateTrackMetrics();
      });

    this.speedResolutionInput$
      .pipe(
        debounceTime(RESOLUTION_INPUT_DEBOUNCE_MS),
        takeUntil(this.destroy$)
      )
      .subscribe((value) => {
        this.settingsStore.setSpeedChartResolutionInSec(value);
        this.store.recalculateTrackMetrics();
      });
  }

  ngOnInit(): void {
    const flightId = this.route.snapshot.paramMap.get('id');

    if (!flightId) {
      return;
    }

    const source = this.route.snapshot.data['source'];

    if (source === 'public') {
      void this.store.loadPublicFlight(flightId);
    } else {
      void this.store.loadFlight(flightId);
    }
  }

  async setViewMode(viewMode: 'map' | '3d'): Promise<void> {
    this.viewMode = viewMode;

    if (viewMode === '3d') {
      await this.loadFlight3dComponent();
    }
  }

  private async loadFlight3dComponent(): Promise<void> {
    if (this.flight3dComponent()) {
      return;
    }

    const module = await import('../../components/flight-3d/flight-3d');

    this.flight3dComponent.set(module.Flight3d);
  }

  setTrackColorMode(event: Event): void {
    const value = (event.target as HTMLSelectElement).value as TrackColorMode;

    this.settingsStore.setTrackColorMode(value);
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

  private toChartPoints(
    timeSec: Int32Array,
    values: Float32Array
  ): FlightChartPoint[] {
    const pointCount = Math.min(timeSec.length, values.length);
    const result: FlightChartPoint[] = [];

    for (let i = 0; i < pointCount; i++) {
      result.push({
        index: i,
        timeSec: timeSec[i],
        value: values[i],
      });
    }

    return result;
  }

  formatDate(value: string | undefined | null): string {
    if (!value) {
      return '—';
    }

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
    if (durationSec == null) {
      return '—';
    }

    const hours = Math.floor(durationSec / 3600);
    const minutes = Math.floor((durationSec % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  formatDistance(distanceM: number | undefined | null): string {
    if (distanceM == null) {
      return '—';
    }

    return `${(distanceM / 1000).toFixed(1)} km`;
  }

  formatHeight(heightM: number | undefined | null): string {
    if (heightM == null) {
      return '—';
    }

    return `${Math.round(heightM)} m`;
  }

  formatSpeed(speedKmh: number | undefined | null): string {
    if (speedKmh == null) {
      return '—';
    }

    return `${Math.round(speedKmh)} km/h`;
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();

    this.store.clear();
  }
}