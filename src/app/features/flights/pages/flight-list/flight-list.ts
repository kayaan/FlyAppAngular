import { Component, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { FlightsStore } from '../../store/flights.store';

@Component({
  selector: 'app-flight-list',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './flight-list.html',
  styleUrl: './flight-list.scss',
})
export class FlightList implements OnInit {
  readonly store = inject(FlightsStore);

  ngOnInit(): void {
    this.store.loadFlights();
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    this.store.importFiles(input.files);
    input.value = '';
  }

  formatDate(value: string | undefined | null): string {
    if (!value) return '—';

    return new Intl.DateTimeFormat('de-DE', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(value));
  }

  formatTime(timeSec: number | undefined | null): string {
    if (timeSec == null) return '—';

    const hours = Math.floor(timeSec / 3600);
    const minutes = Math.floor((timeSec % 3600) / 60);

    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}`;
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
}