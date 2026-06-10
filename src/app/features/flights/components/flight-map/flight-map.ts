import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  effect,
  inject,
  ViewChild,
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
  private trackLayer: L.Polyline | null = null;

  constructor() {
    effect(() => {
      const track = this.store.track();

      if (!this.map || !track) {
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
    this.map?.remove();
    this.map = null;
    this.trackLayer = null;
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
  }

  private renderTrack(): void {
    const track = this.store.track();

    if (!this.map || !track || track.latE7.length === 0) {
      return;
    }

    this.trackLayer?.remove();
    this.trackLayer = null;

    const latLngs: L.LatLngExpression[] = [];

    for (let i = 0; i < track.latE7.length; i++) {
      const lat = track.latE7[i] / 10_000_000;
      const lon = track.lonE7[i] / 10_000_000;

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }

      if (lat === 0 && lon === 0) {
        continue;
      }

      latLngs.push([lat, lon]);
    }

    if (latLngs.length === 0) {
      return;
    }

    this.trackLayer = L.polyline(latLngs, {
      weight: 3,
      opacity: 0.9,
    }).addTo(this.map);

    this.map.fitBounds(L.latLngBounds(latLngs), {
      padding: [24, 24],
    });

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 0);
  }
}