import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightMap } from '../../components/flight-map/flight-map';
import { FlightChartPoint, FlightLineChart } from '../../components/flight-line-chart/flight-line-chart';

@Component({
  selector: 'app-flight-details',
  standalone: true,
  imports: [CommonModule, RouterLink, FlightLineChart, FlightMap],
  templateUrl: './flight-details.html',
  styleUrl: './flight-details.scss',
  providers: [FlightDetailsStore],
})
export class FlightDetails implements OnInit, OnDestroy {
  private readonly route = inject(ActivatedRoute);

  readonly store = inject(FlightDetailsStore);


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

  altitudeData(): FlightChartPoint[] {
    const track = this.store.track();

    if (!track) {
      return [];
    }

    const result: FlightChartPoint[] = [];

    for (let i = 0; i < track.timeSec.length; i++) {
      result.push({
        index: i,
        timeSec: track.timeSec[i],
        value: track.altGpsCm[i] / 100,
      });
    }

    return result;
  }

  varioData(): FlightChartPoint[] {
    const track = this.store.track();

    if (!track) {
      return [];
    }

    const result: FlightChartPoint[] = [];

    result.push({
      index: 0,
      timeSec: track.timeSec[0],
      value: 0,
    });

    for (let i = 1; i < track.timeSec.length; i++) {
      const dt = track.timeSec[i] - track.timeSec[i - 1];

      if (dt <= 0) {
        result.push({
          index: i,
          timeSec: track.timeSec[i],
          value: 0,
        });
        continue;
      }

      const altNowM = track.altGpsCm[i] / 100;
      const altPrevM = track.altGpsCm[i - 1] / 100;

      result.push({
        index: i,
        timeSec: track.timeSec[i],
        value: (altNowM - altPrevM) / dt,
      });
    }

    return result;
  }

  speedData(): FlightChartPoint[] {
    const track = this.store.track();

    if (!track) {
      return [];
    }

    const result: FlightChartPoint[] = [];

    result.push({
      index: 0,
      timeSec: track.timeSec[0],
      value: 0,
    });

    for (let i = 1; i < track.timeSec.length; i++) {
      const dt = track.timeSec[i] - track.timeSec[i - 1];

      if (dt <= 0) {
        result.push({
          index: i,
          timeSec: track.timeSec[i],
          value: 0,
        });
        continue;
      }

      const distanceM = this.distanceMeters(
        track.latE7[i - 1] / 10_000_000,
        track.lonE7[i - 1] / 10_000_000,
        track.latE7[i] / 10_000_000,
        track.lonE7[i] / 10_000_000
      );

      const speedMs = distanceM / dt;
      const speedKmh = speedMs * 3.6;

      result.push({
        index: i,
        timeSec: track.timeSec[i],
        value: speedKmh,
      });
    }

    return result;
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
    this.store.clear();
  }
}