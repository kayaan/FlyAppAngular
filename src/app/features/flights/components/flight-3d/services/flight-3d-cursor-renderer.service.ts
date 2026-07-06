import { Injectable, inject } from '@angular/core';

import {
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  Entity,
  HeightReference,
  PointGraphics,
  Viewer,
} from 'cesium';
import { TrackArrays } from '../../../models/track-arrays.model';


import {
  Flight3dPositionOptions,
  Flight3dPositionService,
} from './flight-3d-position.service';

export interface Flight3dCursorRenderOptions extends Flight3dPositionOptions { }

@Injectable()
export class Flight3dCursorRendererService {
  private viewer: Viewer | null = null;
  private cursorEntity: Entity | null = null;

  private readonly positionService = inject(Flight3dPositionService);

  attach(viewer: Viewer): void {
    this.viewer = viewer;
  }

  clear(): void {
    if (!this.viewer || !this.cursorEntity) {
      this.cursorEntity = null;
      return;
    }

    this.viewer.entities.remove(this.cursorEntity);
    this.cursorEntity = null;
  }

  update(
    track: TrackArrays,
    index: number,
    options: Flight3dCursorRenderOptions
  ): void {
    if (!this.viewer || track.timeSec.length === 0) {
      return;
    }

    const position = this.positionService.buildPosition(track, index, options);

    if (!position) {
      this.clear();
      return;
    }

    if (!this.cursorEntity) {
      this.cursorEntity = this.viewer.entities.add({
        name: 'Chart cursor position',
        position: new ConstantPositionProperty(position),
        point: new PointGraphics({
          pixelSize: new ConstantProperty(12),
          color: new ConstantProperty(Color.YELLOW),
          outlineColor: new ConstantProperty(Color.BLACK),
          outlineWidth: new ConstantProperty(2),
          heightReference: new ConstantProperty(HeightReference.NONE),
          disableDepthTestDistance: new ConstantProperty(
            Number.POSITIVE_INFINITY
          ),
        }),
      });

      return;
    }

    this.cursorEntity.position = new ConstantPositionProperty(position);
  }
}