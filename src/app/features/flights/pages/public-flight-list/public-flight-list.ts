import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { PublicFlightsApiService } from '../../services/public-flights-api.service';
import { PublicFlight } from '../../models/public-flight.model';

@Component({
  selector: 'app-public-flight-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './public-flight-list.html',
  styleUrl: './public-flight-list.scss',
})
export class PublicFlightList {
  private readonly api = inject(PublicFlightsApiService);

  readonly flights = signal<PublicFlight[]>([]);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly totalItems = signal(0);
  readonly page = signal(0);
  readonly totalPages = signal(0);

  readonly hasFlights = computed(() => this.flights().length > 0);

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    try {
      const result = await firstValueFrom(this.api.getPublicFlights());

      this.flights.set(result.items);
      this.totalItems.set(result.totalItems);
      this.page.set(result.page);
      this.totalPages.set(result.totalPages);
    } catch (error) {
      console.error('Failed to load public flights', error);
      this.error.set('Public flights could not be loaded.');
    } finally {
      this.loading.set(false);
    }
  }

  formatDate(value: string | null): string {
    if (!value) {
      return '—';
    }

    return new Date(value).toLocaleDateString();
  }

  formatDuration(seconds: number | null): string {
    if (seconds === null) {
      return '—';
    }

    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes}m`;
  }

  formatDistance(meters: number | null): string {
    if (meters === null) {
      return '—';
    }

    return `${(meters / 1000).toFixed(1)} km`;
  }

  formatAltitude(meters: number | null): string {
    if (meters === null) {
      return '—';
    }

    return `${Math.round(meters)} m`;
  }
}