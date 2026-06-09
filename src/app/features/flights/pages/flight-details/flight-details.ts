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

  ngOnDestroy(): void {
    this.store.clear();
  }
}