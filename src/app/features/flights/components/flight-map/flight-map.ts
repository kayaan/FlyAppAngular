// import {
//   AfterViewInit,
//   Component,
//   ElementRef,
//   Input,
//   OnChanges,
//   OnDestroy,
//   SimpleChanges,
//   ViewChild,
// } from '@angular/core';

// import * as L from 'leaflet';

// import { TrackArrays } from '../../models/track-arrays.model';

// @Component({
//   selector: 'app-flight-map',
//   standalone: true,
//   templateUrl: './flight-map.html',
//   styleUrl: './flight-map.scss',
// })
// export class FlightMap implements AfterViewInit, OnChanges, OnDestroy {
//   @Input() track: TrackArrays | null = null;

//   @ViewChild('mapContainer', { static: true })
//   private mapContainer!: ElementRef<HTMLDivElement>;

//   private map: L.Map | null = null;
//   private trackLayer: L.Polyline | null = null;

//   ngAfterViewInit(): void {
//     this.map = L.map(this.mapContainer.nativeElement, {
//       zoomControl: true,
//       attributionControl: true,
//     });

//     L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
//       maxZoom: 18,
//       attribution: '© OpenStreetMap contributors',
//     }).addTo(this.map);

//     this.updateTrack();

//     setTimeout(() => {
//       this.map?.invalidateSize();
//     });
//   }

//   ngOnChanges(changes: SimpleChanges): void {
//     if (!this.map) {
//       return;
//     }

//     if (changes['track']) {
//       this.updateTrack();
//     }
//   }

//   ngOnDestroy(): void {
//     this.map?.remove();
//     this.map = null;
//   }

//   private updateTrack(): void {
//     if (!this.map || !this.track || this.track.latE7.length === 0) {
//       return;
//     }

//     const points: L.LatLngExpression[] = [];

//     for (let i = 0; i < this.track.latE7.length; i++) {
//       points.push([
//         this.track.latE7[i] / 10_000_000,
//         this.track.lonE7[i] / 10_000_000,
//       ]);
//     }

//     if (this.trackLayer) {
//       this.trackLayer.removeFrom(this.map);
//     }

//     this.trackLayer = L.polyline(points, {
//       weight: 3,
//       opacity: 0.9,
//     }).addTo(this.map);

//     this.map.fitBounds(this.trackLayer.getBounds(), {
//       padding: [24, 24],
//     });

//     setTimeout(() => {
//       this.map?.invalidateSize();
//     });
//   }
// }