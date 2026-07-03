import { Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import {
  PublicFlightsApiService,
  PublicFlightSort,
  PublicFlightsQuery,
} from '../../services/public-flights-api.service';
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

  readonly q = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly sort = signal<PublicFlightSort>('newest');

  readonly hasFlights = computed(() => this.flights().length > 0);

  readonly hasActiveFilters = computed(
    () =>
      this.q().trim().length > 0 ||
      this.from().length > 0 ||
      this.to().length > 0 ||
      this.sort() !== 'newest'
  );

  constructor() {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);

    const query: PublicFlightsQuery = {
      q: this.q(),
      from: this.from() || null,
      to: this.to() || null,
      sort: this.sort(),
      page: 0,
      size: 50,
    };

    try {
      const result = await firstValueFrom(this.api.getPublicFlights(query));

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

  async applyFilters(): Promise<void> {
    await this.load();
  }

  async clearFilters(): Promise<void> {
    this.q.set('');
    this.from.set('');
    this.to.set('');
    this.sort.set('newest');

    await this.load();
  }

  onSearchInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.q.set(input.value);
  }

  onFromInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.from.set(input.value);
  }

  onToInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.to.set(input.value);
  }

  onSortChange(event: Event): void {
    const select = event.target as HTMLSelectElement;
    this.sort.set(select.value as PublicFlightSort);
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