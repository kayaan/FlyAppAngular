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

import { TrackArrays } from '../../../models/track-arrays.model';
import { Flight3dPositionOptions, Flight3dPositionService } from './flight-3d-position.service';

export interface Flight3dSelectedClimbRenderOptions
  extends Flight3dPositionOptions {
  renderStep: number;
}

@Injectable()
export class Flight3dSelectedClimbRendererService {
  private readonly positionService = inject(Flight3dPositionService);

  private viewer: Viewer | null = null;
  private selectedClimbEntity: Entity | null = null;

  attach(viewer: Viewer): void {
    this.viewer = viewer;
  }

  clear(): void {
    if (!this.viewer || !this.selectedClimbEntity) {
      this.selectedClimbEntity = null;
      return;
    }

    this.viewer.entities.remove(this.selectedClimbEntity);
    this.selectedClimbEntity = null;
  }

  render(
    track: TrackArrays,
    startIndex: number,
    endIndex: number,
    options: Flight3dSelectedClimbRenderOptions
  ): void {
    if (!this.viewer) {
      return;
    }

    this.clear();

    const pointCount = this.positionService.getPointCount(track);

    if (pointCount < 2) {
      return;
    }

    const start = Math.max(0, Math.min(startIndex, endIndex));
    const end = Math.min(pointCount - 1, Math.max(startIndex, endIndex));

    const positions: Cartesian3[] = [];
    const step = Math.max(1, Math.round(options.renderStep));

    for (let i = start; i <= end; i += step) {
      const position = this.positionService.buildPosition(track, i, options);

      if (position) {
        positions.push(position);
      }
    }

    const lastPosition = this.positionService.buildPosition(track, end, options);

    if (lastPosition && positions[positions.length - 1] !== lastPosition) {
      positions.push(lastPosition);
    }

    if (positions.length < 2) {
      return;
    }

    this.selectedClimbEntity = this.viewer.entities.add({
      name: 'Selected climb highlight',
      polyline: {
        positions,
        width: new ConstantProperty(6),
        material: new ColorMaterialProperty(Color.YELLOW.withAlpha(0.95)),
        clampToGround: false,
        arcType: ArcType.NONE,
      },
    });
  }
}