import { Injectable } from '@angular/core';

import * as L from 'leaflet';

import { ColoredTrackSegment } from '../../../models/colored-track-segment.model';

@Injectable()
export class FlightMapTrackRendererService {
  private trackLayers: L.Polyline[] = [];
  private didFitBounds = false;

  clear(): void {
    for (const layer of this.trackLayers) {
      layer.remove();
    }

    this.trackLayers = [];
  }

  addLayer(layer: L.Polyline): void {
    this.trackLayers.push(layer);
  }

  renderColoredSegments(
    map: L.Map,
    segments: ColoredTrackSegment[]
  ): void {
    this.clear();

    if (segments.length === 0) {
      return;
    }

    const boundsPoints: L.LatLngExpression[] = [];

    for (const segment of segments) {
      const validPoints = segment.points.filter(([lat, lon]) => {
        if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
          return false;
        }

        return !(lat === 0 && lon === 0);
      });

      if (validPoints.length < 2) {
        continue;
      }

      const layer = L.polyline(validPoints, {
        pane: 'trackPane',
        color: segment.color,
        weight: 5,
        opacity: 0.95,
        interactive: false,
      }).addTo(map);

      this.addLayer(layer);
      boundsPoints.push(...validPoints);
    }

    if (!this.didFitBounds && boundsPoints.length > 0) {
      map.fitBounds(L.latLngBounds(boundsPoints), {
        padding: [24, 24],
      });

      this.didFitBounds = true;
    }

    this.invalidateSizeAsync(map);
  }

  private invalidateSizeAsync(map: L.Map): void {
    window.setTimeout(() => {
      map.invalidateSize();
    }, 0);
  }
}