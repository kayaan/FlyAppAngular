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
  Cartesian2,
  createWorldTerrainAsync,
  EllipsoidTerrainProvider,
  Ion,
  Viewer,
} from 'cesium';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';
import { TrackArrays } from '../../models/track-arrays.model';
import { ReplayRange } from '../../models/replay-state.model';

import { environment } from '../../../../../environments/environment';

import { FlightReplayInfoOverlay } from '../flight-replay-info-overlay/flight-replay-info-overlay';
import { Flight3dTrackRendererService, Flight3dTrackRenderOptions } from './services/flight-3d-track-renderer.service';
import { Flight3dCursorRendererService } from './services/flight-3d-cursor-renderer.service';
import { Flight3dSelectedClimbRendererService } from './services/flight-3d-selected-climb-renderer.service';
import { Flight3dReplayRendererService, Flight3dReplayRenderOptions } from './services/flight-3d-replay-renderer.service';
import { Flight3dPositionOptions, Flight3dPositionService } from './services/flight-3d-position.service';
import { Flight3dReplayCameraService } from './services/flight-3d-replay-camera.service';
import { Flight3dPickingService } from './services/flight-3d-picking.service';

@Component({
  selector: 'app-flight-3d',
  standalone: true,
  imports: [
    FlightReplayInfoOverlay
  ],
  providers: [
    Flight3dPositionService,
    Flight3dTrackRendererService,
    Flight3dCursorRendererService,
    Flight3dSelectedClimbRendererService,
    Flight3dReplayRendererService,
    Flight3dReplayCameraService,
    Flight3dPickingService,
  ],
  templateUrl: './flight-3d.html',
  styleUrl: './flight-3d.scss',
})
export class Flight3d implements AfterViewInit, OnDestroy {
  @ViewChild('cesiumContainer', { static: true })
  private cesiumContainer!: ElementRef<HTMLDivElement>;

  private readonly store = inject(FlightDetailsStore);
  private readonly settingsStore = inject(FlightSettingsStore);
  private readonly cursorRenderer = inject(Flight3dCursorRendererService);
  private readonly trackRenderer = inject(Flight3dTrackRendererService);
  private readonly selectedClimbRenderer = inject(Flight3dSelectedClimbRendererService);
  private readonly replayRenderer = inject(Flight3dReplayRendererService);
  private readonly replayCamera = inject(Flight3dReplayCameraService);
  private readonly pickingService = inject(Flight3dPickingService);

  private viewer: Viewer | null = null;
  private lastTrackReference: TrackArrays | null = null;
  private lastTrackRenderKey = '';

  private lastCameraFollowEnabled = false;

  constructor() {
    this.registerTrackRenderEffect();
    this.registerCursorRenderEffect();
    this.registerSelectedClimbRenderEffect();
    this.registerReplayRenderEffect();
  }

  private registerTrackRenderEffect(): void {
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
  }

  private registerCursorRenderEffect(): void {
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

      this.cursorRenderer.update(
        track,
        cursorIndex,
        this.buildPositionOptions()
      );
    });
  }

  private registerSelectedClimbRenderEffect(): void {
    effect(() => {
      const track = this.store.track();
      const climbs = this.store.climbs();
      const selectedClimbId = this.store.selectedClimbId();
      const showOnlySelectedClimbIn3d =
        this.store.showOnlySelectedClimbTrack();
      const replayActive = this.store.replay.active();

      if (
        !this.viewer ||
        !track ||
        replayActive ||
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
          ...this.buildPositionOptions(),
          renderStep: this.settingsStore.threeDRenderStep(),
        }
      );
    });
  }

  private registerReplayRenderEffect(): void {
    effect(() => {
      const track = this.store.track();
      const replayActive = this.store.replay.active();
      const replayIndex = this.store.replay.index();
      const replayRange = this.store.replay.range();
      const cameraFollowEnabled = this.store.replay.cameraFollowEnabled();

      if (!this.viewer || !track || !replayActive || replayIndex === null) {
        this.replayCamera.reset();
        this.lastCameraFollowEnabled = false;
        this.replayRenderer.clear();
        return;
      }

      // During replay, the selected climb is represented by the replay range.
      // The yellow climb highlight would be a duplicate visual marker.
      this.selectedClimbRenderer.clear();

      this.replayRenderer.render(
        track,
        this.buildReplayRenderOptions(replayIndex, replayRange)
      );

      const cameraFollowJustEnabled =
        cameraFollowEnabled && !this.lastCameraFollowEnabled;

      this.lastCameraFollowEnabled = cameraFollowEnabled;

      if (cameraFollowEnabled) {
        this.replayCamera.follow(track, replayIndex, {
          ...this.buildPositionOptions(),
          resetView: cameraFollowJustEnabled,
        });
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
  private handleTrackHover(mousePosition: Cartesian2): void {
    if (this.store.replay.active()) {
      return;
    }

    const track = this.store.track();

    if (!this.viewer || !track) {
      this.store.setCursorIndex(null);
      return;
    }

    const nearestIndex = this.pickingService.findNearestTrackIndexByScreenPosition(
      track,
      mousePosition,
      {
        ...this.buildPositionOptions(),
        renderStep: this.settingsStore.threeDRenderStep(),
        maxPixelDistance: 18,
      }
    );

    if (nearestIndex === null) {
      this.store.setCursorIndex(null);
      return;
    }

    if (this.store.cursorIndex() !== nearestIndex) {
      this.store.setCursorIndex(nearestIndex);
    }
  }

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
    this.replayRenderer.attach(this.viewer);
    this.replayCamera.attach(this.viewer);
    this.pickingService.attach(this.viewer, (mousePosition) => {
      this.handleTrackHover(mousePosition);
    });

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
    this.cursorRenderer.clear();
    this.replayRenderer.clear();
    this.selectedClimbRenderer.clear();
    this.trackRenderer.clear();
    this.viewer?.destroy();
    this.viewer = null;
    this.lastTrackReference = null;
    this.lastTrackRenderKey = '';
    this.lastCameraFollowEnabled = false;

    this.pickingService.destroy();
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
      this.settingsStore.threeDVerticalExaggeration(),
      this.settingsStore.threeDVerticalExaggerationRelativeHeight(),
      this.settingsStore.threeDRenderStep(),
      this.settingsStore.threeDVarioClassCount(),
      this.settingsStore.threeDMaxVarioForColorMs(),

      // Wichtig: beeinflusst den tatsächlich gezeichneten 3D-Track
      this.store.showOnlySelectedClimbTrack(),
      this.store.selectedClimbId(),
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

  private buildReplayRenderOptions(
    replayIndex: number,
    replayRange: ReplayRange | null
  ): Flight3dReplayRenderOptions {
    return {
      replayIndex,
      replayRange,
      replayTrailDurationSec: this.store.replay().replayTrailDurationSec,

      renderStep: this.settingsStore.threeDRenderStep(),
      trackAltitudeOffsetM: this.settingsStore.threeDTrackAltitudeOffsetM(),
      verticalExaggeration: this.settingsStore.threeDVerticalExaggeration(),
      verticalExaggerationRelativeHeight:
        this.settingsStore.threeDVerticalExaggerationRelativeHeight(),
    };
  }

  private buildPositionOptions(): Flight3dPositionOptions {
    return {
      trackAltitudeOffsetM: this.settingsStore.threeDTrackAltitudeOffsetM(),
      verticalExaggeration: this.settingsStore.threeDVerticalExaggeration(),
      verticalExaggerationRelativeHeight:
        this.settingsStore.threeDVerticalExaggerationRelativeHeight(),
    };
  }
}
