import {
  AfterViewInit,
  Component,
  effect,
  ElementRef,
  inject,
  OnDestroy,
  ViewChild,
} from '@angular/core';

import {
  ArcType,
  Cartesian3,
  Cartographic,
  Color,
  EllipsoidTerrainProvider,
  Entity,
  HeightReference,
  Ion,
  PointGraphics,
  ScreenSpaceEventHandler,
  ScreenSpaceEventType,
  Viewer,
  createWorldTerrainAsync,
  Math as CesiumMath,
  Cartesian2,
  SceneTransforms,
} from 'cesium';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';
import { TrackArrays } from '../../models/track-arrays.model';

@Component({
  selector: 'app-flight-3d',
  standalone: true,
  templateUrl: './flight-3d.html',
  styleUrl: './flight-3d.scss',
})
export class Flight3d implements AfterViewInit, OnDestroy {
  @ViewChild('cesiumContainer', { static: true })
  private cesiumContainer!: ElementRef<HTMLDivElement>;

  private readonly store = inject(FlightDetailsStore);
  private readonly settingsStore = inject(FlightSettingsStore);

  private readonly verticalExaggeration = 2.0;
  private readonly verticalExaggerationRelativeHeight = 0.0;

  private readonly trackAltitudeOffsetM = 100;

  private readonly renderStep = 3;
  private readonly varioClassCount = 12;
  private readonly maxVarioForColorMs = 4;


  private viewer: Viewer | null = null;
  private flightTrackEntities: Entity[] = [];
  private lastTrackReference: TrackArrays | null = null;
  private selectedClimbEntity: Entity | null = null;

  private cursorEntity: Entity | null = null;

  private mouseMoveHandler: ScreenSpaceEventHandler | null = null;


  constructor() {
    effect(() => {
      const track = this.store.track();

      // Re-render colors when resolution changes.
      this.settingsStore.varioChartResolutionInSec();

      // Re-render 3D track when selected climb / only-mode changes.
      this.store.showOnlySelectedClimbTrack();
      this.store.selectedClimbId();
      this.store.climbs();

      if (!this.viewer) {
        return;
      }

      const shouldCenter = track !== this.lastTrackReference;

      this.renderTrack(track, shouldCenter);

      this.lastTrackReference = track;
    });

    effect(() => {
      const track = this.store.track();
      const cursorIndex = this.store.cursorIndex();

      if (!this.viewer || !track || cursorIndex === null) {
        this.clearCursorEntity();
        return;
      }

      this.updateCursorEntity(track, cursorIndex);
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
        this.clearSelectedClimbEntity();
        return;
      }

      const selectedClimb = climbs.find((climb) => climb.id === selectedClimbId);

      if (!selectedClimb) {
        this.clearSelectedClimbEntity();
        return;
      }

      this.renderSelectedClimbHighlight(
        track,
        selectedClimb.startIndex,
        selectedClimb.endIndex
      );
    });
  }

  private renderSelectedClimbHighlight(
    track: TrackArrays,
    startIndex: number,
    endIndex: number
  ): void {

    if (this.store.showOnlySelectedClimbTrack()) {
      this.clearSelectedClimbEntity();
      return;
    }

    if (!this.viewer) {
      return;
    }

    this.clearSelectedClimbEntity();

    const pointCount = Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length,
      track.timeSec.length
    );

    if (pointCount < 2) {
      return;
    }

    const start = Math.max(0, Math.min(startIndex, endIndex));
    const end = Math.min(pointCount - 1, Math.max(startIndex, endIndex));

    const positions: Cartesian3[] = [];

    for (let i = start; i <= end; i += this.renderStep) {
      const position = this.buildPosition(track, i);

      if (position) {
        positions.push(position);
      }
    }

    if (positions.length < 2) {
      return;
    }

    this.selectedClimbEntity = this.viewer.entities.add({
      name: 'Selected climb highlight',
      polyline: {
        positions,
        width: 6,
        material: Color.YELLOW.withAlpha(0.95),
        clampToGround: false,
        arcType: ArcType.NONE,
      },
    });
  }

  private clearSelectedClimbEntity(): void {
    if (!this.viewer || !this.selectedClimbEntity) {
      this.selectedClimbEntity = null;
      return;
    }

    this.viewer.entities.remove(this.selectedClimbEntity);
    this.selectedClimbEntity = null;
  }

  async ngAfterViewInit(): Promise<void> {
    Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiJlYzNkODk4Mi1lNzYwLTQzNGUtOTNlNC04MDMwOTBiYmI4ZDQiLCJpZCI6NDQzODEzLCJzdWIiOiJBeWRpbiBLYXlhIiwiaXNzIjoiaHR0cHM6Ly9hcGkuY2VzaXVtLmNvbSIsImF1ZCI6IlVudGl0bGVkIiwiaWF0IjoxNzgxMzA1MDc4fQ.IuzlHEZoO7BhDqRcMhOl_Eq76TMUYUn0qqnhHnOkuqY',

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

    this.registerCursorPicking();

    this.viewer.terrainProvider = await createWorldTerrainAsync({
      requestVertexNormals: true,
    });

    // Keep imagery visible, but disable day/night darkening.
    this.viewer.scene.globe.enableLighting = false;
    this.viewer.scene.globe.showGroundAtmosphere = false;

    // Keep the flight track visible even if terrain exaggeration would
    // otherwise hide parts of it behind the terrain.
    this.viewer.scene.globe.depthTestAgainstTerrain = false;

    this.viewer.scene.verticalExaggeration = this.verticalExaggeration;
    this.viewer.scene.verticalExaggerationRelativeHeight =
      this.verticalExaggerationRelativeHeight;

    if (this.viewer.scene.skyAtmosphere) {
      this.viewer.scene.skyAtmosphere.show = false;
    }

    if (this.viewer.scene.sun) {
      this.viewer.scene.sun.show = false;
    }

    if (this.viewer.scene.moon) {
      this.viewer.scene.moon.show = false;
    }

    this.renderTrack(this.store.track(), true);
    this.lastTrackReference = this.store.track();
  }


  ngOnDestroy(): void {
    this.mouseMoveHandler?.destroy();
    this.mouseMoveHandler = null;

    this.clearCursorEntity();
    this.clearTrackEntities();

    this.viewer?.destroy();
    this.viewer = null;
    this.lastTrackReference = null;

    this.clearSelectedClimbEntity();
  }

  private registerCursorPicking(): void {
    if (!this.viewer) {
      return;
    }

    this.mouseMoveHandler = new ScreenSpaceEventHandler(
      this.viewer.scene.canvas
    );

    this.mouseMoveHandler.setInputAction((movement: { endPosition: Cartesian2 }) => {
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

    const pointCount = Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length,
      track.timeSec.length
    );

    if (pointCount === 0) {
      return null;
    }

    const maxPixelDistance = 18;

    let bestIndex: number | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (let i = 0; i < pointCount; i += this.renderStep) {
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

  private updateCursorEntity(track: TrackArrays, index: number): void {
    if (!this.viewer) {
      return;
    }

    if (index < 0 || index >= track.latE7.length) {
      this.clearCursorEntity();
      return;
    }

    const position = this.buildPosition(track, index);

    if (!position) {
      this.clearCursorEntity();
      return;
    }

    if (!this.cursorEntity) {
      this.cursorEntity = this.viewer.entities.add({
        name: 'Chart cursor position',
        position,
        point: new PointGraphics({
          pixelSize: 12,
          color: Color.YELLOW,
          outlineColor: Color.BLACK,
          outlineWidth: 2,
          heightReference: HeightReference.NONE,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        }),
      });

      return;
    }

    this.cursorEntity.position = position as any;
  }

  private clearCursorEntity(): void {
    if (!this.viewer || !this.cursorEntity) {
      this.cursorEntity = null;
      return;
    }

    this.viewer.entities.remove(this.cursorEntity);
    this.cursorEntity = null;
  }


  private renderTrack(track: TrackArrays | null, shouldCenter: boolean): void {
    if (!this.viewer) {
      return;
    }

    this.clearTrackEntities();

    if (!track || track.latE7.length < 2) {
      return;
    }

    const showOnlySelectedClimbIn3d =
      this.store.showOnlySelectedClimbTrack();

    const selectedClimbId = this.store.selectedClimbId();


    this.clearSelectedClimbEntity();

    if (showOnlySelectedClimbIn3d && selectedClimbId !== null) {
      this.flightTrackEntities = this.buildSelectedClimbTrackBlocks(track);
    } else {
      this.flightTrackEntities = this.buildColoredTrackBlocks(track);
    }

    if (this.flightTrackEntities.length === 0) {
      return;
    }

    if (shouldCenter) {
      this.viewer.flyTo(this.flightTrackEntities, {
        duration: 0.8,
      });
    }
  }

  private buildSelectedClimbTrackBlocks(track: TrackArrays): Entity[] {
    if (!this.viewer) {
      return [];
    }

    const selectedClimbId = this.store.selectedClimbId();

    if (selectedClimbId === null) {
      return this.buildColoredTrackBlocks(track);
    }

    const selectedClimb = this.store
      .climbs()
      .find((climb) => climb.id === selectedClimbId);

    if (!selectedClimb) {
      return this.buildColoredTrackBlocks(track);
    }

    const pointCount = Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length,
      track.timeSec.length
    );

    const start = Math.max(
      0,
      Math.min(selectedClimb.startIndex, selectedClimb.endIndex)
    );

    const end = Math.min(
      pointCount - 1,
      Math.max(selectedClimb.startIndex, selectedClimb.endIndex)
    );

    const entities: Entity[] = [];

    let currentClass: number | null = null;
    let currentPositions: Cartesian3[] = [];

    for (let i = start; i <= end; i += this.renderStep) {
      const position = this.buildPosition(track, i);

      if (!position) {
        continue;
      }

      if (currentPositions.length === 0) {
        currentPositions.push(position);
        continue;
      }

      const varioMs = this.averageVarioMs(
        track,
        i,
        this.settingsStore.varioChartResolutionInSec()
      );

      const nextClass = this.getVarioClass(varioMs);

      if (currentClass === null) {
        currentClass = nextClass;
        currentPositions.push(position);
        continue;
      }

      if (nextClass === currentClass) {
        currentPositions.push(position);
        continue;
      }

      if (currentPositions.length >= 2) {
        entities.push(this.addTrackBlockEntity(currentPositions, currentClass));
      }

      currentClass = nextClass;
      currentPositions = [
        currentPositions[currentPositions.length - 1],
        position,
      ];
    }

    if (currentClass !== null && currentPositions.length >= 2) {
      entities.push(this.addTrackBlockEntity(currentPositions, currentClass));
    }

    return entities;
  }

  private clearTrackEntities(): void {
    if (!this.viewer) {
      this.flightTrackEntities = [];
      return;
    }

    for (const entity of this.flightTrackEntities) {
      this.viewer.entities.remove(entity);
    }

    this.flightTrackEntities = [];
  }

  private buildColoredTrackBlocks(track: TrackArrays): Entity[] {
    if (!this.viewer) {
      return [];
    }

    const entities: Entity[] = [];

    const pointCount = Math.min(
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length,
      track.timeSec.length
    );

    let currentClass: number | null = null;
    let currentPositions: Cartesian3[] = [];

    for (let i = 0; i < pointCount; i += this.renderStep) {
      const position = this.buildPosition(track, i);

      if (!position) {
        continue;
      }

      if (currentPositions.length === 0) {
        currentPositions.push(position);
        continue;
      }

      const varioMs = this.averageVarioMs(
        track,
        i,
        this.settingsStore.varioChartResolutionInSec()
      );

      const nextClass = this.getVarioClass(varioMs);

      if (currentClass === null) {
        currentClass = nextClass;
        currentPositions.push(position);
        continue;
      }

      if (nextClass === currentClass) {
        currentPositions.push(position);
        continue;
      }

      if (currentPositions.length >= 2) {
        entities.push(this.addTrackBlockEntity(currentPositions, currentClass));
      }

      currentClass = nextClass;
      currentPositions = [
        currentPositions[currentPositions.length - 1],
        position,
      ];
    }

    if (currentClass !== null && currentPositions.length >= 2) {
      entities.push(this.addTrackBlockEntity(currentPositions, currentClass));
    }

    return entities;
  }

  private addTrackBlockEntity(
    positions: Cartesian3[],
    varioClass: number
  ): Entity {
    if (!this.viewer) {
      throw new Error('Cesium viewer is not initialized.');
    }

    return this.viewer.entities.add({
      name: 'Flight track block',
      polyline: {
        positions,
        width: 1.5,
        material: this.getColorForVarioClass(varioClass),
        clampToGround: false,
        arcType: ArcType.NONE,
      },
    });
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

  private averageVarioMs(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const previousIndex = this.findPreviousIndexByResolution(
      track,
      index,
      resolutionSec
    );

    const deltaAltM =
      (track.altGpsCm[index] - track.altGpsCm[previousIndex]) / 100;

    const deltaTimeSec =
      track.timeSec[index] - track.timeSec[previousIndex];

    if (deltaTimeSec <= 0) {
      return 0;
    }

    return deltaAltM / deltaTimeSec;
  }

  private findPreviousIndexByResolution(
    track: TrackArrays,
    index: number,
    resolutionSec: number
  ): number {
    const currentTimeSec = track.timeSec[index];
    const minTimeSec = currentTimeSec - resolutionSec;

    let previousIndex = index;

    while (
      previousIndex > 0 &&
      track.timeSec[previousIndex] > minTimeSec
    ) {
      previousIndex--;
    }

    return previousIndex;
  }

  private getVarioClass(varioMs: number): number {
    if (!Number.isFinite(varioMs)) {
      return 1; // fallback: hellgrün statt weiß
    }

    const clamped = Math.max(
      -this.maxVarioForColorMs,
      Math.min(this.maxVarioForColorMs, varioMs)
    );

    const strength = Math.abs(clamped) / this.maxVarioForColorMs;

    const level = Math.max(
      1,
      Math.min(
        this.varioClassCount,
        Math.ceil(strength * this.varioClassCount)
      )
    );

    return clamped >= 0 ? level : -level;
  }

  private getColorForVarioClass(varioClass: number): Color {
    const lightGreen = Color.fromCssColorString('#22d3ee'); // weak climb cyan
    const darkGreen = Color.fromCssColorString('#0f766e');  // strong climb teal

    const lightRed = Color.fromCssColorString('#ef4444');
    const darkRed = Color.fromCssColorString('#7f1d1d');

    const level = Math.min(this.varioClassCount, Math.abs(varioClass));
    const t = level / this.varioClassCount;

    if (varioClass > 0) {
      return this.interpolateColor(lightGreen, darkGreen, t).withAlpha(1.0);
    }

    return this.interpolateColor(lightRed, darkRed, t).withAlpha(1.0);
  }

  private interpolateColor(from: Color, to: Color, t: number): Color {
    const clampedT = Math.max(0, Math.min(1, t));

    return new Color(
      from.red + (to.red - from.red) * clampedT,
      from.green + (to.green - from.green) * clampedT,
      from.blue + (to.blue - from.blue) * clampedT,
      from.alpha + (to.alpha - from.alpha) * clampedT
    );
  }

  private exaggerateHeight(heightM: number): number {
    return (
      this.trackAltitudeOffsetM +
      this.verticalExaggerationRelativeHeight +
      (heightM - this.verticalExaggerationRelativeHeight) *
      this.verticalExaggeration
    );
  }
}