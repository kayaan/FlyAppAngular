import { Injectable, inject } from '@angular/core';

import * as L from 'leaflet';

import { Climb } from '../../../models/climb.model';
import { TrackArrays } from '../../../models/track-arrays.model';
import { FlightMapPointService } from './flight-map-point.service';

@Injectable()
export class FlightMapSelectedClimbRendererService {
  private readonly pointService = inject(FlightMapPointService);

  private selectedClimbHaloLayer: L.Polyline | null = null;

  renderHalo(
    map: L.Map,
    track: TrackArrays,
    climbs: Climb[],
    selectedClimbId: number | null
  ): void {
    this.clearHalo();

    if (selectedClimbId === null) {
      return;
    }

    const climb = climbs.find((x) => x.id === selectedClimbId);

    if (!climb) {
      return;
    }

    const points = this.pointService.buildTrackPoints(
      track,
      climb.startIndex,
      climb.endIndex
    );

    if (points.length < 2) {
      return;
    }

    this.selectedClimbHaloLayer = L.polyline(points, {
      pane: 'selectedClimbHaloPane',
      color: '#0b26f5',
      weight: 16,
      opacity: 0.96,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(map);
  }

  clearHalo(): void {
    this.selectedClimbHaloLayer?.remove();
    this.selectedClimbHaloLayer = null;
  }
}