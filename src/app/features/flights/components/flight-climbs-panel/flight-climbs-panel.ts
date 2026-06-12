import { Component, inject } from '@angular/core';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';

@Component({
  selector: 'app-flight-climbs-panel',
  standalone: true,
  templateUrl: './flight-climbs-panel.html',
  styleUrl: './flight-climbs-panel.scss',
})
export class FlightClimbsPanel {
  readonly detailsStore = inject(FlightDetailsStore);
  readonly settingsStore = inject(FlightSettingsStore);

  toggleShowClimbsOnCharts(event: Event): void {
    const input = event.target as HTMLInputElement;

    this.settingsStore.setShowClimbsOnCharts(input.checked);
  }

  protected showFullFlight(): void {
    this.detailsStore.clearSelectedClimb();
    this.detailsStore.zoomToSelectedClimb();
  }
}