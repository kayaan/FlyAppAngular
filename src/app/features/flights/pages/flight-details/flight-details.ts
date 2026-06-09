import { Component, OnDestroy, OnInit, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { FlightDetailsStore } from '../../store/flight-details.store';

@Component({
  selector: 'app-flight-details',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './flight-details.html',
  styleUrl: './flight-details.scss',
})
export class FlightDetails implements OnInit, OnDestroy {
  readonly store = inject(FlightDetailsStore);

  private readonly route = inject(ActivatedRoute);

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