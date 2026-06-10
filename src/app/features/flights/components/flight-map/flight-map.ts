import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  ViewChild,
  effect,
  inject,
} from '@angular/core';

import * as L from 'leaflet';

import { FlightDetailsStore } from '../../store/flight-details.store';

@Component({
  selector: 'app-flight-map',
  standalone: true,
  templateUrl: './flight-map.html',
  styleUrl: './flight-map.scss',
})
export class FlightMap implements AfterViewInit, OnDestroy {
  private readonly store = inject(FlightDetailsStore);

  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  private map: L.Map | null = null;

  private trackLayers: L.Polyline[] = [];
  private didFitBounds = false;

  constructor() {
    effect(() => {
      const segments = this.store.coloredTrackSegments();

      if (!this.map || segments.length === 0) {
        return;
      }

      this.renderTrack();
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.renderTrack();
  }

  ngOnDestroy(): void {
    this.clearTrackLayers();

    this.map?.remove();
    this.map = null;
  }

  private initMap(): void {
    if (this.map) {
      return;
    }

    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: true,
    });

    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        'SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(this.map);

    this.map.setView([48.7758, 9.1829], 10);

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 0);
  }

  private renderTrack(): void {
    if (!this.map) {
      return;
    }

    const segments = this.store.coloredTrackSegments();

    if (segments.length === 0) {
      return;
    }

    this.clearTrackLayers();

    const boundsPoints: L.LatLngExpression[] = [];

    for (const segment of segments) {
      if (segment.points.length < 2) {
        continue;
      }

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
        color: segment.color,
        weight: 4,
        opacity: 0.95,
        interactive: false,
      }).addTo(this.map);

      this.trackLayers.push(layer);
      boundsPoints.push(...validPoints);
    }

    if (!this.didFitBounds && boundsPoints.length > 0) {
      this.map.fitBounds(L.latLngBounds(boundsPoints), {
        padding: [24, 24],
      });

      this.didFitBounds = true;
    }

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 0);
  }

  private clearTrackLayers(): void {
    for (const layer of this.trackLayers) {
      layer.remove();
    }

    this.trackLayers = [];
  }
}