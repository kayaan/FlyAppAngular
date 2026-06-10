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
  /**
   * The map component reads the current flight data directly from the
   * FlightDetailsStore.
   *
   * Important:
   * This component has no @Input() and no @Output().
   * It relies on the FlightDetailsStore instance provided by the parent
   * FlightDetails page.
   */
  private readonly store = inject(FlightDetailsStore);

  /**
   * Reference to the real DOM element in flight-map.html.
   *
   * Leaflet needs a normal HTML div as container.
   * Angular gives us access to that div via @ViewChild().
   */
  @ViewChild('mapContainer', { static: true })
  private mapContainer!: ElementRef<HTMLDivElement>;

  /**
   * Leaflet map instance.
   *
   * Created once in ngAfterViewInit().
   * Removed again in ngOnDestroy().
   */
  private map: L.Map | null = null;

  /**
   * Current flight track layer on the map.
   *
   * We keep this reference so we can remove the old track
   * before drawing a new one.
   */
  private trackLayer: L.Polyline | null = null;

  constructor() {
    /**
     * React to changes in the FlightDetailsStore.
     *
     * When the store receives the track from IndexedDB,
     * this effect runs automatically and redraws the map.
     *
     * The effect may run before the Leaflet map exists.
     * Therefore we check `!this.map` and return early.
     */
    effect(() => {
      const track = this.store.track();

      if (!this.map || !track) {
        return;
      }

      this.renderTrack();
    });
  }

  ngAfterViewInit(): void {
    /**
     * The map container div exists only after the view was initialized.
     * Therefore Leaflet must be initialized here, not in the constructor.
     */
    this.initMap();

    /**
     * If the track is already available, draw it immediately.
     * If not, the effect in the constructor will render it later.
     */
    this.renderTrack();
  }

  ngOnDestroy(): void {
    /**
     * Clean up the Leaflet map.
     *
     * Leaflet attaches event listeners and DOM state internally.
     * Calling remove() prevents memory leaks when the component is destroyed.
     */
    this.map?.remove();

    this.map = null;
    this.trackLayer = null;
  }

  private initMap(): void {
    /**
     * Prevent duplicate initialization.
     *
     * This method should create the Leaflet map only once.
     */
    if (this.map) {
      return;
    }

    /**
     * Create the Leaflet map inside the Angular template container.
     *
     * zoomControl:
     *   Shows the + / - zoom buttons.
     *
     * attributionControl:
     *   Shows map attribution.
     *   This should stay enabled for OpenStreetMap/OpenTopoMap tiles.
     */
    this.map = L.map(this.mapContainer.nativeElement, {
      zoomControl: true,
      attributionControl: true,
    });

    /**
     * Add OpenTopoMap as tile layer.
     *
     * This gives us a topographic map:
     * - terrain shading
     * - contour lines
     * - paths
     * - roads
     *
     * Good first choice for paragliding flight visualization.
     */
    L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      maxZoom: 17,

      /**
       * Attribution is required by the tile provider.
       * Do not remove this for public usage.
       */
      attribution:
        'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, ' +
        'SRTM | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (CC-BY-SA)',
    }).addTo(this.map);

    /**
     * Initial fallback position.
     *
     * This is only visible before a flight track is rendered.
     * Once the track is drawn, fitBounds() zooms to the real flight area.
     *
     * Current fallback: Stuttgart.
     */
    this.map.setView([48.7758, 9.1829], 10);
  }

  private renderTrack(): void {
    /**
     * Read the current track from the store.
     *
     * No input parameter is needed because this component is store-connected.
     */
    const track = this.store.track();

    /**
     * Nothing to draw if:
     * - the map is not initialized yet
     * - no track is loaded yet
     * - the track contains no coordinates
     */
    if (!this.map || !track || track.latE7.length === 0) {
      return;
    }

    /**
     * Remove old track layer before drawing the new one.
     *
     * Otherwise every store update would add another polyline
     * on top of the previous one.
     */
    this.trackLayer?.remove();
    this.trackLayer = null;

    /**
     * Convert our compact track arrays into Leaflet coordinates.
     *
     * Our storage format:
     *   latE7 = latitude  * 10_000_000
     *   lonE7 = longitude * 10_000_000
     *
     * Leaflet expects decimal degrees:
     *   [latitude, longitude]
     */
    const latLngs: L.LatLngExpression[] = [];

    for (let i = 0; i < track.latE7.length; i++) {
      const lat = track.latE7[i] / 10_000_000;
      const lon = track.lonE7[i] / 10_000_000;

      /**
       * Skip invalid coordinates.
       */
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
        continue;
      }

      /**
       * Skip [0, 0].
       *
       * This is usually not a real flight coordinate.
       * It normally indicates invalid or missing data.
       */
      if (lat === 0 && lon === 0) {
        continue;
      }

      latLngs.push([lat, lon]);
    }

    /**
     * If all points were invalid, do not draw anything.
     */
    if (latLngs.length === 0) {
      return;
    }

    /**
     * Draw the flight track as a polyline.
     *
     * Later this can be replaced by segmented polylines:
     * - color by vario
     * - color by speed
     * - color by altitude
     */
    this.trackLayer = L.polyline(latLngs, {
      weight: 3,
      opacity: 0.9,
    }).addTo(this.map);

    /**
     * Zoom the map to the full flight track.
     */
    this.map.fitBounds(L.latLngBounds(latLngs), {
      padding: [24, 24],
    });

    /**
     * Important for maps inside flexible/resizable layouts.
     *
     * Leaflet sometimes calculates the map size before the layout
     * has its final size. invalidateSize() forces Leaflet to recalculate.
     */
    setTimeout(() => {
      this.map?.invalidateSize();
    }, 0);
  }
}