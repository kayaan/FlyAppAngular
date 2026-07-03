import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, effect, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AuthStore } from '../../../auth/store/auth.store';
import { FlightSyncEventsService } from '../../services/flight-sync-events.service';
import { FlightsStore } from '../../store/flights.store';

@Component({
  selector: 'app-flight-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './flight-list.html',
  styleUrl: './flight-list.scss',
})
export class FlightList implements OnInit, OnDestroy {
  public readonly store = inject(FlightsStore);
  public readonly authStore = inject(AuthStore);

  private readonly syncEvents = inject(FlightSyncEventsService);

  private eventSource: EventSource | null = null;

  private readonly authEffect = effect(() => {
    const authenticated = this.authStore.authenticated();

    if (authenticated) {
      void this.store.loadBackendFlights();
      this.openSyncEvents();
      return;
    }

    this.closeSyncEvents();
    this.store.clearBackendState();
  });

  ngOnInit(): void {
    void this.store.loadFlights();
  }

  ngOnDestroy(): void {
    this.closeSyncEvents();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    void this.store.importFiles(input.files);

    input.value = '';
  }

  formatDate(value: string | null | undefined): string {
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

  formatTime(timeSec: number | null | undefined): string {
    if (timeSec == null) {
      return '—';
    }

    const hours = Math.floor(timeSec / 3600);
    const minutes = Math.floor((timeSec % 3600) / 60);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
  }

  formatDuration(durationSec: number | null | undefined): string {
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

  formatDistance(distanceM: number | null | undefined): string {
    if (distanceM == null) {
      return '—';
    }

    return `${(distanceM / 1000).toFixed(1)} km`;
  }

  formatHeight(heightM: number | null | undefined): string {
    if (heightM == null) {
      return '—';
    }

    return `${Math.round(heightM)} m`;
  }

  private openSyncEvents(): void {
    if (this.eventSource) {
      return;
    }

    this.eventSource = this.syncEvents.connect(() => {
      void this.store.loadBackendFlights();
    });
  }

  private closeSyncEvents(): void {
    if (!this.eventSource) {
      return;
    }

    this.eventSource.close();
    this.eventSource = null;
  }
}