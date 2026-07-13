import { inject, Injectable } from '@angular/core';

import {
  ArcType,
  Cartesian3,
  Color,
  ColorMaterialProperty,
  ConstantProperty,
  Entity,
  Viewer,
} from 'cesium';

import { Climb } from '../../../models/climb.model';
import { TrackColorMode } from '../../../models/flight-settings.model';
import { TrackMetrics } from '../../../models/track-metrics.model';
import { TrackArrays } from '../../../models/track-arrays.model';
import { TrackColorService } from '../../../services/track-color.service';
import { TrackMathUtils } from '../../../domain/track-math-utils';
import { Flight3dPositionOptions, Flight3dPositionService } from './flight-3d-position.service';

export interface Flight3dTrackRenderOptions extends Flight3dPositionOptions {
  trackColorMode: TrackColorMode;

  varioChartResolutionInSec: number;

  renderStep: number;
  varioClassCount: number;
  maxVarioForColorMs: number;

  showOnlySelectedClimbTrack: boolean;
  selectedClimbId: number | null;
  climbs: Climb[];

  metrics: TrackMetrics | null;

  replayActive: boolean;
  shouldCenter: boolean;
}

@Injectable()
export class Flight3dTrackRendererService {
  private readonly trackColorService = inject(TrackColorService);
  private readonly positionService = inject(Flight3dPositionService);

  private viewer: Viewer | null = null;
  private flightTrackEntities: Entity[] = [];

  attach(viewer: Viewer): void {
    this.viewer = viewer;
  }

  hasRenderedTrack(): boolean {
    return this.flightTrackEntities.length > 0;
  }

  clear(): void {
    if (!this.viewer) {
      this.flightTrackEntities = [];
      return;
    }

    for (const entity of this.flightTrackEntities) {
      this.viewer.entities.remove(entity);
    }

    this.flightTrackEntities = [];
  }

  setGhostMode(enabled: boolean): void {
    for (const entity of this.flightTrackEntities) {
      entity.show = true;

      const polyline = entity.polyline;

      if (!polyline) {
        continue;
      }

      polyline.width = new ConstantProperty(enabled ? 1.5 : 3);

      const colorCss = entity.properties?.getValue()?.['colorCss'] as
        | string
        | undefined;

      if (!colorCss) {
        continue;
      }

      const color = Color.fromCssColorString(colorCss).withAlpha(
        enabled ? 0.8 : 1.0
      );

      polyline.material = new ColorMaterialProperty(color);
    }
  }

  render(track: TrackArrays | null, options: Flight3dTrackRenderOptions): void {
    if (!this.viewer) {
      return;
    }

    this.clear();

    if (!track || track.latE7.length < 2) {
      return;
    }

    if (options.showOnlySelectedClimbTrack && options.selectedClimbId !== null) {
      this.flightTrackEntities = this.buildSelectedClimbTrackBlocks(
        track,
        options
      );
    } else {
      this.flightTrackEntities = this.buildColoredTrackBlocks(track, options);
    }

    if (this.flightTrackEntities.length === 0) {
      return;
    }

    this.setGhostMode(options.replayActive);

    if (options.shouldCenter) {
      this.viewer.flyTo(this.flightTrackEntities, {
        duration: 0.8,
      });
    }
  }

  private buildSelectedClimbTrackBlocks(
    track: TrackArrays,
    options: Flight3dTrackRenderOptions
  ): Entity[] {
    if (!this.viewer) {
      return [];
    }

    if (options.selectedClimbId === null) {
      return this.buildColoredTrackBlocks(track, options);
    }

    const selectedClimb = options.climbs.find(
      (climb) => climb.id === options.selectedClimbId
    );

    if (!selectedClimb) {
      return this.buildColoredTrackBlocks(track, options);
    }

    const pointCount = this.positionService.getPointCount(track);

    const start = Math.max(
      0,
      Math.min(selectedClimb.startIndex, selectedClimb.endIndex)
    );

    const end = Math.min(
      pointCount - 1,
      Math.max(selectedClimb.startIndex, selectedClimb.endIndex)
    );

    const entities: Entity[] = [];

    let currentColorKey: string | null = null;
    let currentColor: Color | null = null;
    let currentPositions: Cartesian3[] = [];

    for (let i = start; i <= end; i += this.getRenderStep(options)) {
      const position = this.positionService.buildPosition(track, i, options);

      if (!position) {
        continue;
      }

      if (currentPositions.length === 0) {
        currentPositions.push(position);
        continue;
      }

      const nextColorInfo = this.getTrackColorInfo(track, i, options);

      if (currentColorKey === null || currentColor === null) {
        currentColorKey = nextColorInfo.key;
        currentColor = nextColorInfo.color;
        currentPositions.push(position);
        continue;
      }

      if (nextColorInfo.key === currentColorKey) {
        currentPositions.push(position);
        continue;
      }

      if (currentPositions.length >= 2) {
        entities.push(this.addTrackBlockEntity(currentPositions, currentColor));
      }

      currentColorKey = nextColorInfo.key;
      currentColor = nextColorInfo.color;
      currentPositions = [
        currentPositions[currentPositions.length - 1],
        position,
      ];
    }

    if (currentColor !== null && currentPositions.length >= 2) {
      entities.push(this.addTrackBlockEntity(currentPositions, currentColor));
    }

    return entities;
  }

  private buildColoredTrackBlocks(
    track: TrackArrays,
    options: Flight3dTrackRenderOptions
  ): Entity[] {
    if (!this.viewer) {
      return [];
    }

    const entities: Entity[] = [];
    const pointCount = this.positionService.getPointCount(track);

    let currentColorKey: string | null = null;
    let currentColor: Color | null = null;
    let currentPositions: Cartesian3[] = [];

    for (let i = 0; i < pointCount; i += this.getRenderStep(options)) {
      const position = this.positionService.buildPosition(track, i, options);

      if (!position) {
        continue;
      }

      if (currentPositions.length === 0) {
        currentPositions.push(position);
        continue;
      }

      const nextColorInfo = this.getTrackColorInfo(track, i, options);

      if (currentColorKey === null || currentColor === null) {
        currentColorKey = nextColorInfo.key;
        currentColor = nextColorInfo.color;
        currentPositions.push(position);
        continue;
      }

      if (nextColorInfo.key === currentColorKey) {
        currentPositions.push(position);
        continue;
      }

      if (currentPositions.length >= 2) {
        entities.push(this.addTrackBlockEntity(currentPositions, currentColor));
      }

      currentColorKey = nextColorInfo.key;
      currentColor = nextColorInfo.color;
      currentPositions = [
        currentPositions[currentPositions.length - 1],
        position,
      ];
    }

    if (currentColor !== null && currentPositions.length >= 2) {
      entities.push(this.addTrackBlockEntity(currentPositions, currentColor));
    }

    return entities;
  }

  private addTrackBlockEntity(positions: Cartesian3[], color: Color): Entity {
    if (!this.viewer) {
      throw new Error('Cesium viewer is not initialized.');
    }

    const colorCss = this.colorToCss(color);

    return this.viewer.entities.add({
      name: 'Flight track block',
      properties: {
        colorCss,
      },
      polyline: {
        positions,
        width: new ConstantProperty(3),
        material: new ColorMaterialProperty(color),
        clampToGround: false,
        arcType: ArcType.NONE,
      },
    });
  }

  private getTrackColorInfo(
    track: TrackArrays,
    index: number,
    options: Flight3dTrackRenderOptions
  ): { key: string; color: Color } {
    if (options.trackColorMode === 'speed') {
      const speedKmh =
        options.metrics && index >= 0 && index < options.metrics.speedKmh.length
          ? options.metrics.speedKmh[index]
          : 0;

      const colorCss = this.trackColorService.getSpeedColorCss(speedKmh);
      const color = Color.fromCssColorString(colorCss).withAlpha(1.0);

      return {
        key: `speed-${colorCss}`,
        color,
      };
    }

    const varioMs = TrackMathUtils.averageVarioMs(
      track,
      index,
      options.varioChartResolutionInSec
    );

    const varioClass = this.getVarioClass(varioMs, options);

    return {
      key: `vario-${varioClass}`,
      color: this.getColorForVarioClass(varioClass, options),
    };
  }


  private getVarioClass(
    varioMs: number,
    options: Flight3dTrackRenderOptions
  ): number {
    if (!Number.isFinite(varioMs)) {
      return 1;
    }

    const maxVario = Math.max(0.1, options.maxVarioForColorMs);
    const classCount = Math.max(1, Math.round(options.varioClassCount));

    const clamped = Math.max(-maxVario, Math.min(maxVario, varioMs));
    const strength = Math.abs(clamped) / maxVario;

    const level = Math.max(
      1,
      Math.min(classCount, Math.ceil(strength * classCount))
    );

    return clamped >= 0 ? level : -level;
  }

  private getColorForVarioClass(
    varioClass: number,
    options: Flight3dTrackRenderOptions
  ): Color {
    const lightGreen = Color.fromCssColorString('#22d3ee');
    const darkGreen = Color.fromCssColorString('#0f766e');

    const lightRed = Color.fromCssColorString('#ef4444');
    const darkRed = Color.fromCssColorString('#7f1d1d');

    const classCount = Math.max(1, Math.round(options.varioClassCount));
    const level = Math.min(classCount, Math.abs(varioClass));
    const t = level / classCount;

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

  private colorToCss(color: Color): string {
    const r = Math.round(color.red * 255);
    const g = Math.round(color.green * 255);
    const b = Math.round(color.blue * 255);

    return `rgb(${r}, ${g}, ${b})`;
  }

  private getRenderStep(options: Flight3dTrackRenderOptions): number {
    return Math.max(1, Math.round(options.renderStep));
  }
}