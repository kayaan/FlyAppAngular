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
import { TrackArrays } from '../../models/track-arrays.model';
import { Climb } from '../../models/climb.model';

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

  private hoverTooltip: L.Tooltip | null = null;
  private readonly hoverTolerancePx = 16;

  private hoverPointMarker: L.CircleMarker | null = null;
  private hoverHaloMarker: L.CircleMarker | null = null;

  private selectedClimbHaloLayer: L.Polyline | null = null;

  private handledZoomToSelectedClimbRequest = 0;

  constructor() {
    effect(() => {
      this.store.coloredTrackSegments();

      this.store.track();
      this.store.climbs();
      this.store.selectedClimbId();
      this.store.showOnlySelectedClimbTrack();

      if (!this.map) {
        return;
      }

      this.renderTrack();
    });

    effect(() => {
      const cursorIndex = this.store.cursorIndex();

      if (!this.map) {
        return;
      }

      if (cursorIndex === null) {
        this.hideHoverTooltip();
        this.hideHoverPoint();
        return;
      }

      this.showCursorAtIndex(cursorIndex);
    });

    effect(() => {
      const track = this.store.track();
      const climbs = this.store.climbs();
      const selectedClimbId = this.store.selectedClimbId();
      const showOnlySelectedClimbTrack =
        this.store.showOnlySelectedClimbTrack();

      if (!this.map || !track) {
        return;
      }

      if (showOnlySelectedClimbTrack) {
        this.clearSelectedClimbHalo();
        return;
      }

      this.renderSelectedClimbHalo(track, climbs, selectedClimbId);
    });

    effect(() => {
      const request = this.store.zoomToSelectedClimbRequest();

      if (!this.map || request === 0) {
        return;
      }

      if (request === this.handledZoomToSelectedClimbRequest) {
        return;
      }

      this.handledZoomToSelectedClimbRequest = request;

      const track = this.store.track();
      const climbs = this.store.climbs();
      const selectedClimbId = this.store.selectedClimbId();

      if (!track) {
        return;
      }

      this.fitMapToSelection(track, climbs, selectedClimbId);
    });
  }

  ngAfterViewInit(): void {
    this.initMap();
    this.renderTrack();
  }

  ngOnDestroy(): void {
    if (!this.store.isReplayPlaying()) {
      this.store.setCursorIndex(null);
    }

    this.hideHoverTooltip();
    this.hideHoverPoint();
    this.clearSelectedClimbHalo();
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

    this.map.on('mousemove', (event: L.LeafletMouseEvent) => {
      this.handleMapMouseMove(event);
    });

    this.map.on('mouseout', () => {
      if (this.store.isReplayPlaying()) {
        return;
      }

      this.hideHoverTooltip();
      this.hideHoverPoint();
      this.store.setCursorIndex(null);
    });

    this.map.createPane('selectedClimbHaloPane');
    this.map.getPane('selectedClimbHaloPane')!.style.zIndex = '410';

    this.map.createPane('trackPane');
    this.map.getPane('trackPane')!.style.zIndex = '420';

    this.map.createPane('cursorPane');
    this.map.getPane('cursorPane')!.style.zIndex = '500';
    this.map.getPane('cursorPane')!.style.pointerEvents = 'none';

    this.map.createPane('cursorTooltipPane');
    this.map.getPane('cursorTooltipPane')!.style.zIndex = '510';
    this.map.getPane('cursorTooltipPane')!.style.pointerEvents = 'none';

    setTimeout(() => {
      this.map?.invalidateSize();
    }, 0);
  }

  private handleMapMouseMove(event: L.LeafletMouseEvent): void {
    if (this.store.isReplayPlaying()) {
      return;
    }

    if (!this.map) {
      return;
    }

    const track = this.store.track();

    if (!track || track.latE7.length < 2) {
      this.hideHoverTooltip();
      this.hideHoverPoint();
      this.store.setCursorIndex(null);
      return;
    }

    const nearest = this.findNearestTrackIndex(event.latlng);

    if (!nearest || nearest.distancePx > this.hoverTolerancePx) {
      this.hideHoverTooltip();
      this.hideHoverPoint();
      this.store.setCursorIndex(null);
      return;
    }

    const index = nearest.index;

    if (this.store.cursorIndex() !== index) {
      this.store.setCursorIndex(index);
    }

    this.showHoverTooltip(
      nearest.latLng,
      this.buildHoverTooltipContent(index),
    );

    this.showHoverPoint(nearest.latLng);
  }

  private showCursorAtIndex(index: number): void {
    const track = this.store.track();

    if (!this.map || !track) {
      return;
    }

    if (index < 0 || index >= track.latE7.length) {
      this.hideHoverTooltip();
      this.hideHoverPoint();
      return;
    }

    const lat = track.latE7[index] / 10_000_000;
    const lon = track.lonE7[index] / 10_000_000;

    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      this.hideHoverTooltip();
      this.hideHoverPoint();
      return;
    }

    if (lat === 0 && lon === 0) {
      this.hideHoverTooltip();
      this.hideHoverPoint();
      return;
    }

    const latLng = L.latLng(lat, lon);

    this.showHoverPoint(latLng);
    this.showHoverTooltip(latLng, this.buildHoverTooltipContent(index));
  }

  private fitMapToSelection(
    track: TrackArrays,
    climbs: Climb[],
    selectedClimbId: number | null,
  ): void {
    if (!this.map) {
      return;
    }

    if (selectedClimbId === null) {
      this.fitMapToTrack(track);
      return;
    }

    const climb = climbs.find((x) => x.id === selectedClimbId);

    if (!climb) {
      return;
    }

    const points = this.buildTrackPoints(
      track,
      climb.startIndex,
      climb.endIndex,
    );

    if (points.length < 2) {
      return;
    }

    this.map.fitBounds(L.latLngBounds(points), {
      padding: [48, 48],
      maxZoom: 15,
      animate: true,
    });
  }

  private fitMapToTrack(track: TrackArrays): void {
    if (!this.map) {
      return;
    }

    const points = this.buildTrackPoints(
      track,
      0,
      track.latE7.length - 1,
    );

    if (points.length < 2) {
      return;
    }

    this.map.fitBounds(L.latLngBounds(points), {
      padding: [24, 24],
      animate: true,
    });
  }

  private buildTrackPoints(
    track: TrackArrays,
    startIndex: number,
    endIndex: number,
  ): L.LatLngExpression[] {
    const points: L.LatLngExpression[] = [];

    const safeStartIndex = Math.max(0, startIndex);
    const safeEndIndex = Math.min(track.latE7.length - 1, endIndex);

    for (let i = safeStartIndex; i <= safeEndIndex; i++) {
      const lat = track.latE7[i] / 10_000_000;
      const lon = track.lonE7[i] / 10_000_000;

      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }

      if (lat === 0 && lon === 0) {
        continue;
      }

      points.push([lat, lon]);
    }

    return points;
  }

  private renderSelectedClimbHalo(
    track: TrackArrays,
    climbs: Climb[],
    selectedClimbId: number | null,
  ): void {
    if (!this.map) {
      return;
    }

    this.selectedClimbHaloLayer?.remove();
    this.selectedClimbHaloLayer = null;

    if (selectedClimbId === null) {
      return;
    }

    const climb = climbs.find((x) => x.id === selectedClimbId);

    if (!climb) {
      return;
    }

    const points: L.LatLngExpression[] = [];

    for (let i = climb.startIndex; i <= climb.endIndex; i++) {
      points.push([
        track.latE7[i] / 10_000_000,
        track.lonE7[i] / 10_000_000,
      ]);
    }

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
    }).addTo(this.map);
  }

  private clearSelectedClimbHalo(): void {
    this.selectedClimbHaloLayer?.remove();
    this.selectedClimbHaloLayer = null;
  }

  private findNearestTrackIndex(
    mouseLatLng: L.LatLng,
  ): { index: number; latLng: L.LatLng; distancePx: number } | null {
    if (!this.map) {
      return null;
    }

    const track = this.store.track();

    if (!track || track.latE7.length < 2) {
      return null;
    }

    const mousePoint = this.map.latLngToLayerPoint(mouseLatLng);

    let bestIndex = -1;
    let bestLatLng: L.LatLng | null = null;
    let bestDistancePx = Number.POSITIVE_INFINITY;

    for (let i = 1; i < track.latE7.length; i++) {
      const lat1 = track.latE7[i - 1] / 10_000_000;
      const lon1 = track.lonE7[i - 1] / 10_000_000;
      const lat2 = track.latE7[i] / 10_000_000;
      const lon2 = track.lonE7[i] / 10_000_000;

      if (
        !Number.isFinite(lat1) ||
        !Number.isFinite(lon1) ||
        !Number.isFinite(lat2) ||
        !Number.isFinite(lon2)
      ) {
        continue;
      }

      if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) {
        continue;
      }

      const p1 = this.map.latLngToLayerPoint([lat1, lon1]);
      const p2 = this.map.latLngToLayerPoint([lat2, lon2]);

      const nearestPoint = this.closestPointOnSegment(mousePoint, p1, p2);
      const distancePx = mousePoint.distanceTo(nearestPoint);

      if (distancePx < bestDistancePx) {
        bestDistancePx = distancePx;
        bestIndex = i;
        bestLatLng = this.map.layerPointToLatLng(nearestPoint);
      }
    }

    if (bestIndex < 0 || !bestLatLng) {
      return null;
    }

    return {
      index: bestIndex,
      latLng: bestLatLng,
      distancePx: bestDistancePx,
    };
  }

  private closestPointOnSegment(
    point: L.Point,
    segmentStart: L.Point,
    segmentEnd: L.Point,
  ): L.Point {
    const dx = segmentEnd.x - segmentStart.x;
    const dy = segmentEnd.y - segmentStart.y;

    if (dx === 0 && dy === 0) {
      return segmentStart;
    }

    const t =
      ((point.x - segmentStart.x) * dx + (point.y - segmentStart.y) * dy) /
      (dx * dx + dy * dy);

    const clampedT = Math.max(0, Math.min(1, t));

    return L.point(
      segmentStart.x + clampedT * dx,
      segmentStart.y + clampedT * dy,
    );
  }

  private buildHoverTooltipContent(index: number): string {
    const track = this.store.track();

    if (!track) {
      return '';
    }

    const altitudeM = track.altGpsCm[index] / 100;
    const varioMs = this.calculateInstantVarioMs(index);
    const speedKmh = this.calculateInstantSpeedKmh(index);

    return `
      <div class="map-hover-tooltip">
        <div><strong>Altitude:</strong> ${altitudeM.toFixed(0)} m</div>
        <div><strong>Vario:</strong> ${varioMs.toFixed(1)} m/s</div>
        <div><strong>Speed:</strong> ${speedKmh.toFixed(0)} km/h</div>
      </div>
    `;
  }

  private calculateInstantVarioMs(index: number): number {
    const track = this.store.track();

    if (!track || index <= 0) {
      return 0;
    }

    const durationSec = track.timeSec[index] - track.timeSec[index - 1];

    if (durationSec <= 0) {
      return 0;
    }

    const altitudeDeltaM =
      (track.altGpsCm[index] - track.altGpsCm[index - 1]) / 100;

    return altitudeDeltaM / durationSec;
  }

  private calculateInstantSpeedKmh(index: number): number {
    const track = this.store.track();

    if (!track || index <= 0) {
      return 0;
    }

    const durationSec = track.timeSec[index] - track.timeSec[index - 1];

    if (durationSec <= 0) {
      return 0;
    }

    const lat1 = track.latE7[index - 1] / 10_000_000;
    const lon1 = track.lonE7[index - 1] / 10_000_000;
    const lat2 = track.latE7[index] / 10_000_000;
    const lon2 = track.lonE7[index] / 10_000_000;

    const distanceM = this.distanceMeters(lat1, lon1, lat2, lon2);

    return (distanceM / durationSec) * 3.6;
  }

  private distanceMeters(
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number,
  ): number {
    const earthRadiusM = 6_371_000;

    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) *
      Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

    return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private showHoverTooltip(latLng: L.LatLng, content: string): void {
    if (!this.map) {
      return;
    }

    if (!this.hoverTooltip) {
      this.hoverTooltip = L.tooltip({
        pane: 'cursorTooltipPane',
        permanent: false,
        sticky: false,
        direction: 'top',
        offset: [0, -10],
        opacity: 0.95,
        className: 'flight-map-hover-tooltip',
      });
    }

    this.hoverTooltip
      .setLatLng(latLng)
      .setContent(content)
      .addTo(this.map);
  }

  private hideHoverTooltip(): void {
    if (!this.map || !this.hoverTooltip) {
      return;
    }

    this.map.removeLayer(this.hoverTooltip);
  }

  private showHoverPoint(latLng: L.LatLng): void {
    if (!this.map) {
      return;
    }

    if (!this.hoverHaloMarker) {
      this.hoverHaloMarker = L.circleMarker(latLng, {
        pane: 'cursorPane',
        radius: 11,
        color: '#3d0000',
        weight: 2,
        opacity: 0.75,
        fillColor: '#fa6f6f',
        fillOpacity: 0.25,
        interactive: false,
      }).addTo(this.map);
    } else {
      this.hoverHaloMarker.setLatLng(latLng);
      this.hoverHaloMarker.bringToFront();
    }

    if (!this.hoverPointMarker) {
      this.hoverPointMarker = L.circleMarker(latLng, {
        pane: 'cursorPane',
        radius: 4,
        color: '#ffffff',
        weight: 2,
        opacity: 1,
        fillColor: '#3d0000',
        fillOpacity: 1,
        interactive: false,
      }).addTo(this.map);
    } else {
      this.hoverPointMarker.setLatLng(latLng);
      this.hoverPointMarker.bringToFront();
    }
  }

  private hideHoverPoint(): void {
    if (!this.map) {
      return;
    }

    if (this.hoverPointMarker) {
      this.map.removeLayer(this.hoverPointMarker);
      this.hoverPointMarker = null;
    }

    if (this.hoverHaloMarker) {
      this.map.removeLayer(this.hoverHaloMarker);
      this.hoverHaloMarker = null;
    }
  }

  private renderTrack(): void {
    if (!this.map) {
      return;
    }

    this.clearTrackLayers();

    const showOnlySelectedClimbTrack =
      this.store.showOnlySelectedClimbTrack();

    const track = this.store.track();
    const climbs = this.store.climbs();
    const selectedClimbId = this.store.selectedClimbId();

    if (showOnlySelectedClimbTrack && track && selectedClimbId !== null) {
      const climb = climbs.find((x) => x.id === selectedClimbId);

      if (!climb) {
        return;
      }

      const points = this.buildTrackPoints(
        track,
        climb.startIndex,
        climb.endIndex,
      );

      if (points.length < 2) {
        return;
      }

      this.renderSelectedClimbTrackColored(
        track,
        climb.startIndex,
        climb.endIndex,
      );

      setTimeout(() => {
        this.map?.invalidateSize();
      }, 0);

      return;
    }

    const segments = this.store.coloredTrackSegments();

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

  private renderSelectedClimbTrackColored(
    track: TrackArrays,
    startIndex: number,
    endIndex: number,
  ): void {
    if (!this.map) {
      return;
    }

    const safeStartIndex = Math.max(1, Math.min(startIndex, endIndex));
    const safeEndIndex = Math.min(
      track.latE7.length - 1,
      Math.max(startIndex, endIndex),
    );

    for (let i = safeStartIndex; i <= safeEndIndex; i++) {
      const lat1 = track.latE7[i - 1] / 10_000_000;
      const lon1 = track.lonE7[i - 1] / 10_000_000;
      const lat2 = track.latE7[i] / 10_000_000;
      const lon2 = track.lonE7[i] / 10_000_000;

      if (
        !Number.isFinite(lat1) ||
        !Number.isFinite(lon1) ||
        !Number.isFinite(lat2) ||
        !Number.isFinite(lon2)
      ) {
        continue;
      }

      if ((lat1 === 0 && lon1 === 0) || (lat2 === 0 && lon2 === 0)) {
        continue;
      }

      const varioMs = this.calculateInstantVarioMs(i);

      const layer = L.polyline(
        [
          [lat1, lon1],
          [lat2, lon2],
        ],
        {
          pane: 'trackPane',
          color: this.getTrackColorForVario(varioMs),
          weight: 5,
          opacity: 0.95,
          interactive: false,
        },
      ).addTo(this.map);

      this.trackLayers.push(layer);
    }
  }

  private getTrackColorForVario(varioMs: number): string {
    if (!Number.isFinite(varioMs)) {
      return '#22d3ee';
    }

    if (varioMs >= 0) {
      return '#0f766e';
    }

    return '#dc2626';
  }

  private clearTrackLayers(): void {
    for (const layer of this.trackLayers) {
      layer.remove();
    }

    this.trackLayers = [];
  }

  private toRad(value: number): number {
    return (value * Math.PI) / 180;
  }
}