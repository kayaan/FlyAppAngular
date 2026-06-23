import { CommonModule } from '@angular/common';
import {
  Component,
  ElementRef,
  OnInit,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';

import { Flight } from '../../models/flight.model';
import { FlightsStore } from '../../store/flights.store';

@Component({
  selector: 'app-flight-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './flight-list.html',
  styleUrl: './flight-list.scss',
})
export class FlightList implements OnInit {
  readonly store = inject(FlightsStore);

  private readonly backendSyncFileInput =
    viewChild<ElementRef<HTMLInputElement>>('backendSyncFileInput');

  private readonly selectedBackendSyncFlight = signal<Flight | null>(null);

  ngOnInit(): void {
    void this.store.loadFlights();
    void this.store.loadBackendFlights();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    void this.store.importFiles(input.files);

    input.value = '';
  }

  selectFileForBackendSync(flight: Flight): void {
    this.selectedBackendSyncFlight.set(flight);

    const input = this.backendSyncFileInput()?.nativeElement;
    if (!input) {
      return;
    }

    input.value = '';
    input.click();
  }

  onBackendSyncFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0] ?? null;
    const flight = this.selectedBackendSyncFlight();

    if (!file || !flight) {
      input.value = '';
      this.selectedBackendSyncFlight.set(null);
      return;
    }

    void this.store.syncFlightToBackend(file, flight);

    input.value = '';
    this.selectedBackendSyncFlight.set(null);
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
}