import {
  AfterViewInit,
  Component,
  computed,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import {
  ArcType,
  Cartesian2,
  Cartesian3,
  CallbackProperty,
  Color,
  createWorldTerrainAsync,
  EllipsoidTerrainProvider,
  Entity,
  HeightReference,
  Ion,
  Math as CesiumMath,
  PointGraphics,
  Property,
  SceneTransforms,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  HeadingPitchRange,
  Matrix4,
} from 'cesium';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';
import { TrackArrays } from '../../models/track-arrays.model';
import { ReplayRange } from '../../models/replay-state.model';

import { environment } from '../../../../../environments/environment';

import { TrackColorService } from '../../services/track-color.service';
import { FlightReplayInfoOverlay } from '../flight-replay-info-overlay/flight-replay-info-overlay';
import { Flight3dTrackRendererService, Flight3dTrackRenderOptions } from './services/flight-3d-track-renderer.service';
import { Flight3dCursorRendererService } from './services/flight-3d-cursor-renderer.service';
import { Flight3dSelectedClimbRendererService } from './services/flight-3d-selected-climb-renderer.service';

@Component({
  selector: 'app-flight-3d',
  standalone: true,
  imports: [
    FlightReplayInfoOverlay
  ],
  providers: [
    Flight3dTrackRendererService,
    Flight3dCursorRendererService,
    Flight3dSelectedClimbRendererService,
  ],
  templateUrl: './flight-3d.html',
  styleUrl: './flight-3d.scss',

})
export class Flight3d implements AfterViewInit, OnDestroy {
  @ViewChild('cesiumContainer', { static: true })
  private cesiumContainer!: ElementRef<HTMLDivElement>;

  private readonly store = inject(FlightDetailsStore);
  private readonly settingsStore = inject(FlightSettingsStore);
  private readonly trackColorService = inject(TrackColorService);
  private readonly cursorRenderer = inject(Flight3dCursorRendererService);
  private readonly trackRenderer = inject(Flight3dTrackRendererService);
  private readonly selectedClimbRenderer = inject(Flight3dSelectedClimbRendererService);

  private viewer: Viewer | null = null;
  private lastTrackReference: TrackArrays | null = null;
  private lastTrackRenderKey = '';

  private mouseMoveHandler: ScreenSpaceEventHandler | null = null;

  private replayTrackEntity: Entity | null = null;
  private replayTrackPositions: Cartesian3[] = [];

  private replayStartEntity: Entity | null = null;
  private replayCurrentEntity: Entity | null = null;
  private replayEndEntity: Entity | null = null;

  private smoothedCameraHeadingRad: number | null = null;

  private lastCameraFollowEnabled = false;

  constructor() {
    effect(() => {
      const track = this.store.track();
      const replayActive = this.store.replay.active();

      // Re-render colors when color mode / resolution changes.
      const trackRenderKey = this.buildTrackRenderKey();

      // Re-render 3D track when selected climb / only-mode changes.
      this.store.showOnlySelectedClimbTrack();
      this.store.selectedClimbId();
      this.store.climbs();

      if (!this.viewer) {
        return;
      }

      if (replayActive) {
        this.trackRenderer.setGhostMode(true);
        this.selectedClimbRenderer.clear();
        return;
      }

      this.trackRenderer.setGhostMode(false);

      const shouldCenter = track !== this.lastTrackReference;
      const shouldRenderTrack =
        track !== this.lastTrackReference ||
        trackRenderKey !== this.lastTrackRenderKey ||
        !this.trackRenderer.hasRenderedTrack();

      if (shouldRenderTrack) {
        this.trackRenderer.render(
          track,
          this.buildTrackRenderOptions(shouldCenter, replayActive)
        );

        this.lastTrackReference = track;
        this.lastTrackRenderKey = trackRenderKey;
      }
    });

    effect(() => {
      const track = this.store.track();
      const cursorIndex = this.store.cursorIndex();
      const replayActive = this.store.replay.active();

      if (replayActive) {
        this.cursorRenderer.clear();
        return;
      }

      if (!this.viewer || !track || cursorIndex === null) {
        this.cursorRenderer.clear();
        return;
      }

      this.cursorRenderer.update(track, cursorIndex, {
        trackAltitudeOffsetM: this.settingsStore.threeDTrackAltitudeOffsetM(),
        verticalExaggeration: this.settingsStore.threeDVerticalExaggeration(),
        verticalExaggerationRelativeHeight:
          this.settingsStore.threeDVerticalExaggerationRelativeHeight(),
      });
    });

    effect(() => {
      const track = this.store.track();
      const climbs = this.store.climbs();
      const selectedClimbId = this.store.selectedClimbId();
      const showOnlySelectedClimbIn3d =
        this.store.showOnlySelectedClimbTrack();

      if (
        !this.viewer ||
        !track ||
        selectedClimbId === null ||
        showOnlySelectedClimbIn3d
      ) {
        this.selectedClimbRenderer.clear();
        return;
      }

      const selectedClimb = climbs.find((climb) => climb.id === selectedClimbId);

      if (!selectedClimb) {
        this.selectedClimbRenderer.clear();
        return;
      }

      this.selectedClimbRenderer.render(
        track,
        selectedClimb.startIndex,
        selectedClimb.endIndex,
        {
          renderStep: this.settingsStore.threeDRenderStep(),
          trackAltitudeOffsetM: this.settingsStore.threeDTrackAltitudeOffsetM(),
          verticalExaggeration: this.settingsStore.threeDVerticalExaggeration(),
          verticalExaggerationRelativeHeight:
            this.settingsStore.threeDVerticalExaggerationRelativeHeight(),
        }
      );
    });

    effect(() => {
      const track = this.store.track();
      const replayActive = this.store.replay.active();
      const replayIndex = this.store.replay.index();
      const replayRange = this.store.replay.range();
      const cameraFollowEnabled = this.store.replay.cameraFollowEnabled();

      if (!this.viewer || !track || !replayActive || replayIndex === null) {
        this.smoothedCameraHeadingRad = null;
        this.lastCameraFollowEnabled = false;
        this.clearReplayTrackEntity();
        this.clearReplayEndEntity();
        this.clearReplayStartEntity();
        this.clearReplayCurrentEntity();
        return;
      }

      // During replay, the selected climb is represented by the replay range.
      // The yellow climb highlight would be a duplicate visual marker.
      this.selectedClimbRenderer.clear();

      this.updateReplayStartEntity(track, replayRange);
      this.updateReplayEndEntity(track, replayRange);
      this.updateReplayTrackEntity(track, replayIndex, replayRange);
      this.updateReplayCurrentEntity(track, replayIndex);

      const cameraFollowJustEnabled =
        cameraFollowEnabled && !this.lastCameraFollowEnabled;

      this.lastCameraFollowEnabled = cameraFollowEnabled;

      if (cameraFollowEnabled) {
        this.followReplayCamera(track, replayIndex, cameraFollowJustEnabled);
      }
    });
  }

  readonly replayInfo = computed(() => {
    const track = this.store.track();
    const metrics = this.store.trackMetrics();
    const replay = this.store.replay();

    if (!track || !metrics || !replay.active || replay.index === null) {
      return null;
    }

    const index = Math.max(
      0,
      Math.min(replay.index, metrics.altitudeM.length - 1)
    );

    return {
      index,
      maxIndex: track.timeSec.length - 1,
      relativeTimeSec: track.timeSec[index] - track.timeSec[0],
      altitudeM: metrics.altitudeM[index],
      varioMs: metrics.varioMs[index],
      speedKmh: metrics.speedKmh[index],
    };
  });

  async ngAfterViewInit(): Promise<void> {
    Ion.defaultAccessToken = environment.cesiumToken;

    this.viewer = new Viewer(this.cesiumContainer.nativeElement, {
      animation: false,
      timeline: false,
      baseLayerPicker: false,
      geocoder: false,
      homeButton: false,
      sceneModePicker: false,
      navigationHelpButton: false,
      fullscreenButton: false,
      infoBox: false,
      selectionIndicator: false,
      terrainProvider: new EllipsoidTerrainProvider(),
    });

    this.trackRenderer.attach(this.viewer);
    this.cursorRenderer.attach(this.viewer);
    this.selectedClimbRenderer.attach(this.viewer);

    this.registerCursorPicking();

    this.viewer.terrainProvider = await createWorldTerrainAsync({
      requestVertexNormals: true,
    });

    // Keep imagery visible, but disable day/night darkening.
    this.viewer.scene.globe.enableLighting = false;
    this.viewer.scene.globe.showGroundAtmosphere = false;

    // Keep the flight track visible even if terrain exaggeration would
    // otherwise hide parts of it behind the terrain.
    this.viewer.scene.globe.depthTestAgainstTerrain = true;

    this.viewer.scene.verticalExaggeration = this.settingsStore.threeDVerticalExaggeration();
    this.viewer.scene.verticalExaggerationRelativeHeight =
      this.settingsStore.threeDVerticalExaggerationRelativeHeight();

    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = false;
    }

    if (this.viewer.scene.sun) {
      this.viewer.scene.sun.show = false;
    }

    if (this.viewer.scene.moon) {
      this.viewer.scene.moon.show = false;
    }

    this.trackRenderer.render(
      this.store.track(),
      this.buildTrackRenderOptions(true)
    );
    this.lastTrackReference = this.store.track();
    this.lastTrackRenderKey = this.buildTrackRenderKey();
  }

  ngOnDestroy(): void {
    this.mouseMoveHandler?.destroy();
    this.mouseMoveHandler = null;

    this.cursorRenderer.clear();

    this.clearReplayTrackEntity();
    this.clearReplayStartEntity();
    this.clearReplayEndEntity();
    this.clearReplayCurrentEntity();
    this.selectedClimbRenderer.clear();
    this.trackRenderer.clear();

    this.viewer?.destroy();
    this.viewer = null;
    this.lastTrackReference = null;
    this.lastTrackRenderKey = '';
    this.smoothedCameraHeadingRad = null;
    this.lastCameraFollowEnabled = false;
  }

  formatAltitude(value: number): string {
    return `${Math.round(value)} m`;
  }

  formatVario(value: number): string {
    const sign = value > 0 ? '+' : '';
    return `${sign}${value.toFixed(1)} m/s`;
  }

  formatSpeed(value: number): string {
    return `${Math.round(value)} km/h`;
  }

  private buildTrackRenderKey(): string {
    return [
      this.settingsStore.trackColorMode(),
      this.settingsStore.varioChartResolutionInSec(),
      this.settingsStore.speedChartResolutionInSec(),
      this.settingsStore.threeDTrackAltitudeOffsetM(),
      this.settingsStore.threeDRenderStep(),
      this.settingsStore.threeDVarioClassCount(),
      this.settingsStore.threeDMaxVarioForColorMs(),
    ].join('|');
  }

  private buildTrackRenderOptions(
    shouldCenter: boolean,
    replayActive = this.store.replay.active()
  ): Flight3dTrackRenderOptions {
    return {
      trackColorMode: this.settingsStore.trackColorMode(),

      varioChartResolutionInSec:
        this.settingsStore.varioChartResolutionInSec(),

      renderStep: this.settingsStore.threeDRenderStep(),
      varioClassCount: this.settingsStore.threeDVarioClassCount(),
      maxVarioForColorMs: this.settingsStore.threeDMaxVarioForColorMs(),

      trackAltitudeOffsetM: this.settingsStore.threeDTrackAltitudeOffsetM(),
      verticalExaggeration: this.settingsStore.threeDVerticalExaggeration(),
      verticalExaggerationRelativeHeight:
        this.settingsStore.threeDVerticalExaggerationRelativeHeight(),

      showOnlySelectedClimbTrack: this.store.showOnlySelectedClimbTrack(),
      selectedClimbId: this.store.selectedClimbId(),
      climbs: this.store.climbs(),

      metrics: this.store.trackMetrics(),

      replayActive,
      shouldCenter,
    };
  }

  private updateReplayCurrentEntity(
    track: TrackArrays,
    replayIndex: number
  ): void {
    if (!this.viewer) {
      return;
    }

    const pointCount = this.getPointCount(track);

    if (pointCount === 0) {
      this.clearReplayCurrentEntity();
      return;
    }

    const safeReplayIndex = Math.max(0, Math.min(replayIndex, pointCount - 1));
    const position = this.buildPosition(track, safeReplayIndex);

    if (!position) {
      this.clearReplayCurrentEntity();
      return;
    }

    if (!this.replayCurrentEntity) {
      this.replayCurrentEntity = this.viewer.entities.add({
        name: 'Replay current position',
        position,
        point: new PointGraphics({
          pixelSize: 14,
          color: Color.YELLOW,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
      });

      return;
    }

    this.replayCurrentEntity.position = position as any;
  }

  private clearReplayCurrentEntity(): void {
    if (!this.viewer || !this.replayCurrentEntity) {
      this.replayCurrentEntity = null;
      return;
    }

    this.viewer.entities.remove(this.replayCurrentEntity);
    this.replayCurrentEntity = null;
  }

  private updateReplayStartEntity(
    track: TrackArrays,
    replayRange: ReplayRange | null
  ): void {
    if (!this.viewer) {
      return;
    }

    const pointCount = this.getPointCount(track);

    if (pointCount === 0) {
      this.clearReplayStartEntity();
      return;
    }

    const range = this.normalizeReplayRange(replayRange, pointCount);
    const position = this.buildPosition(track, range.startIndex);

    if (!position) {
      this.clearReplayStartEntity();
      return;
    }

    if (!this.replayStartEntity) {
      this.replayStartEntity = this.viewer.entities.add({
        name: 'Replay start position',
        position,
        point: new PointGraphics({
          pixelSize: 15,
          color: Color.LIME,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
      });

      return;
    }

    this.replayStartEntity.position = position as any;
  }

  private clearReplayStartEntity(): void {
    if (!this.viewer || !this.replayStartEntity) {
      this.replayStartEntity = null;
      return;
    }

    this.viewer.entities.remove(this.replayStartEntity);
    this.replayStartEntity = null;
  }

  private updateReplayEndEntity(
    track: TrackArrays,
    replayRange: ReplayRange | null
  ): void {
    if (!this.viewer) {
      return;
    }

    const pointCount = this.getPointCount(track);

    if (pointCount === 0) {
      this.clearReplayEndEntity();
      return;
    }

    const range = this.normalizeReplayRange(replayRange, pointCount);
    const position = this.buildPosition(track, range.endIndex);

    if (!position) {
      this.clearReplayEndEntity();
      return;
    }

    if (!this.replayEndEntity) {
      this.replayEndEntity = this.viewer.entities.add({
        name: 'Replay end position',
        position,
        point: new PointGraphics({
          pixelSize: 15,
          color: Color.RED,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
      });

      return;
    }

    this.replayEndEntity.position = position as any;
  }

  private clearReplayEndEntity(): void {
    if (!this.viewer || !this.replayEndEntity) {
      this.replayEndEntity = null;
      return;
    }

    this.viewer.entities.remove(this.replayEndEntity);
    this.replayEndEntity = null;
  }

  private updateReplayTrackEntity(
    track: TrackArrays,
    replayIndex: number,
    replayRange: ReplayRange | null
  ): void {
    if (!this.viewer) {
      return;
    }

    const pointCount = this.getPointCount(track);

    if (pointCount < 2) {
      this.clearReplayTrackEntity();
      return;
    }

    const range = this.normalizeReplayRange(replayRange, pointCount);

    const safeReplayIndex = Math.max(
      range.startIndex,
      Math.min(replayIndex, range.endIndex)
    );

    const trailDurationSec = this.store.replay().replayTrailDurationSec;

    let trailStartIndex = range.startIndex;

    if (trailDurationSec !== null) {
      const currentFlightSec = track.timeSec[safeReplayIndex];
      const minTrailTimeSec = currentFlightSec - trailDurationSec;

      trailStartIndex = Math.max(
        range.startIndex,
        this.findIndexAtOrAfterTime(track.timeSec, minTrailTimeSec)
      );
    }

    const positions: Cartesian3[] = [];

    for (let i = trailStartIndex; i <= safeReplayIndex; i += this.settingsStore.threeDRenderStep()) {
      const position = this.buildPosition(track, i);

      if (position) {
        positions.push(position);
      }
    }

    const lastPosition = this.buildPosition(track, safeReplayIndex);

    if (lastPosition) {
      positions.push(lastPosition);
    }

    if (positions.length < 2) {
      this.replayTrackPositions = [];
      return;
    }

    this.replayTrackPositions = positions;

    if (!this.replayTrackEntity) {
      this.replayTrackEntity = this.viewer.entities.add({
        name: 'Replay track',
        polyline: {
          positions: new CallbackProperty(
            () => this.replayTrackPositions,
            false
          ) as unknown as Property,
          width: 4,
          material: Color.fromCssColorString('#ff7a00').withAlpha(1.0),
          clampToGround: false,
          arcType: ArcType.NONE,
        },
      });
    }
  }

  private clearReplayTrackEntity(): void {
    this.replayTrackPositions = [];

    if (!this.viewer || !this.replayTrackEntity) {
      this.replayTrackEntity = null;
      return;
    }

    this.viewer.entities.remove(this.replayTrackEntity);
    this.replayTrackEntity = null;
  }

  private followReplayCamera(
    track: TrackArrays,
    replayIndex: number,
    resetView: boolean
  ): void {
    if (!this.viewer) {
      return;
    }

    const pointCount = this.getPointCount(track);

    if (pointCount < 2) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(replayIndex, pointCount - 1));

    const targetLat = track.latE7[safeIndex] / 10_000_000;
    const targetLon = track.lonE7[safeIndex] / 10_000_000;
    const targetAltM = this.exaggerateHeight(track.altGpsCm[safeIndex] / 100);

    if (
      !Number.isFinite(targetLat) ||
      !Number.isFinite(targetLon) ||
      !Number.isFinite(targetAltM)
    ) {
      return;
    }

    const targetPosition = Cartesian3.fromDegrees(
      targetLon,
      targetLat,
      targetAltM
    );

    const defaultHeading = this.calculateTrackHeading(track, safeIndex);

    // Schräg von oben auf den aktuellen Replay-Punkt.
    const defaultPitch = CesiumMath.toRadians(-55);

    // Etwas weiter weg, damit man Umgebung + Track sieht.
    const defaultRangeM = 2600;

    const currentRangeM = Cartesian3.distance(
      this.viewer.camera.positionWC,
      targetPosition
    );

    const heading = resetView
      ? defaultHeading
      : this.viewer.camera.heading;

    const pitch = resetView
      ? defaultPitch
      : this.viewer.camera.pitch;

    const range =
      resetView || !Number.isFinite(currentRangeM) || currentRangeM < 100
        ? defaultRangeM
        : currentRangeM;

    this.viewer.camera.lookAt(
      targetPosition,
      new HeadingPitchRange(heading, pitch, range)
    );

    // Wichtig: Kamera nach lookAt wieder freigeben,
    // sonst bleibt sie an das lokale Transform gebunden.
    this.viewer.camera.lookAtTransform(Matrix4.IDENTITY);
  }

  private calculateTrackHeading(track: TrackArrays, index: number): number {
    const pointCount = Math.min(track.latE7.length, track.lonE7.length);

    const headingWindow = 80;

    const fromIndex = Math.max(0, index - headingWindow);
    const toIndex = Math.min(pointCount - 1, index + headingWindow);

    if (fromIndex === toIndex) {
      return this.smoothedCameraHeadingRad ?? this.viewer?.camera.heading ?? 0;
    }

    const fromLat = CesiumMath.toRadians(track.latE7[fromIndex] / 10_000_000);
    const fromLon = CesiumMath.toRadians(track.lonE7[fromIndex] / 10_000_000);
    const toLat = CesiumMath.toRadians(track.latE7[toIndex] / 10_000_000);
    const toLon = CesiumMath.toRadians(track.lonE7[toIndex] / 10_000_000);

    const dLon = toLon - fromLon;

    const y = Math.sin(dLon) * Math.cos(toLat);
    const x =
      Math.cos(fromLat) * Math.sin(toLat) -
      Math.sin(fromLat) * Math.cos(toLat) * Math.cos(dLon);

    return Math.atan2(y, x);
  }

  private registerCursorPicking(): void {
    if (!this.viewer) {
      return;
    }

    this.mouseMoveHandler = new ScreenSpaceEventHandler(
      this.viewer.scene.canvas
    );

    this.mouseMoveHandler.setInputAction((movement: { endPosition: Cartesian2 }) => {
      if (this.store.replay.active()) {
        return;
      }

      const track = this.store.track();

      if (!this.viewer || !track) {
        this.store.setCursorIndex(null);
        return;
      }

      const nearestIndex = this.findNearestTrackIndexByScreenPosition(
        track,
        movement.endPosition
      );

      if (nearestIndex === null) {
        this.store.setCursorIndex(null);
        return;
      }

      if (this.store.cursorIndex() !== nearestIndex) {
        this.store.setCursorIndex(nearestIndex);
      }
    }, ScreenSpaceEventType.MOUSE_MOVE);
  }

  private findNearestTrackIndexByScreenPosition(
    track: TrackArrays,
    mousePosition: Cartesian2
  ): number | null {
    if (!this.viewer) {
      return null;
    }

    const pointCount = this.getPointCount(track);

    if (pointCount === 0) {
      return null;
    }

    const maxPixelDistance = 18;

    let bestIndex: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < pointCount; i += this.settingsStore.threeDRenderStep()) {
      const worldPosition = this.buildPosition(track, i);

      if (!worldPosition) {
        continue;
      }

      const screenPosition = SceneTransforms.worldToWindowCoordinates(
        this.viewer.scene,
        worldPosition
      );

      if (!screenPosition) {
        continue;
      }

      const dx = screenPosition.x - mousePosition.x;
      const dy = screenPosition.y - mousePosition.y;
      const distance = Math.sqrt(dx * dx + dy * dy);

      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }

    if (bestIndex === null || bestDistance > maxPixelDistance) {
      return null;
    }

    return bestIndex;
  }

  private buildPosition(track: TrackArrays, index: number): Cartesian3 | null {
    const lat = track.latE7[index] / 10_000_000;
    const lon = track.lonE7[index] / 10_000_000;
    const altM = this.exaggerateHeight(track.altGpsCm[index] / 100);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(altM)
    ) {
      return null;
    }

    return Cartesian3.fromDegrees(lon, lat, altM);
  }


  private exaggerateHeight(heightM: number): number {
    return (
      this.settingsStore.threeDTrackAltitudeOffsetM() +
      this.settingsStore.threeDVerticalExaggerationRelativeHeight() +
      (heightM - this.settingsStore.threeDVerticalExaggerationRelativeHeight()) *
      this.settingsStore.threeDVerticalExaggeration()
    );
  }

  private getPointCount(track: TrackArrays): number {
    return Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length,
      track.timeSec.length
    );
  }

  private findIndexAtOrAfterTime(
    timeSec: Int32Array,
    targetTimeSec: number
  ): number {
    if (timeSec.length === 0) {
      return 0;
    }

    if (targetTimeSec <= timeSec[0]) {
      return 0;
    }

    if (targetTimeSec >= timeSec[timeSec.length - 1]) {
      return timeSec.length - 1;
    }

    let low = 0;
    let high = timeSec.length - 1;

    while (low < high) {
      const mid = Math.floor((low + high) / 2);

      if (timeSec[mid] < targetTimeSec) {
        low = mid + 1;
      } else {
        high = mid;
      }
    }

    return low;
  }

  private normalizeReplayRange(
    replayRange: ReplayRange | null,
    pointCount: number
  ): ReplayRange {
    const lastIndex = Math.max(0, pointCount - 1);

    const startIndex = Math.max(
      0,
      Math.min(replayRange?.startIndex ?? 0, lastIndex)
    );

    const endIndex = Math.max(
      startIndex,
      Math.min(replayRange?.endIndex ?? lastIndex, lastIndex)
    );

    return {
      startIndex,
      endIndex,
    };
  }
}
