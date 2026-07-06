import { Injectable } from '@angular/core';

import {
  Cartesian3,
  Color,
  ConstantPositionProperty,
  ConstantProperty,
  Entity,
  HeightReference,
  PointGraphics,
  Viewer,
} from 'cesium';
import { TrackArrays } from '../models/track-arrays.model';


export interface Flight3dCursorRenderOptions {
  trackAltitudeOffsetM: number;
  verticalExaggeration: number;
  verticalExaggerationRelativeHeight: number;
}

@Injectable()
export class Flight3dCursorRendererService {
  private viewer: Viewer | null = null;
  private cursorEntity: Entity | null = null;

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

    const pointCount = Math.min(
      track.timeSec.length,
      track.latE7.length,
      track.lonE7.length,
      track.altGpsCm.length
    );

    if (pointCount === 0) {
      this.clear();
      return;
    }

    const safeIndex = Math.max(0, Math.min(index, pointCount - 1));

    const lat = track.latE7[safeIndex] / 10_000_000;
    const lon = track.lonE7[safeIndex] / 10_000_000;

    const rawAltitudeM = track.altGpsCm[safeIndex] / 100;
    const altitudeM = this.exaggerateHeight(rawAltitudeM, options);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(altitudeM)
    ) {
      this.clear();
      return;
    }

    if (lat === 0 && lon === 0) {
      this.clear();
      return;
    }

    const position = Cartesian3.fromDegrees(lon, lat, altitudeM);

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

  private exaggerateHeight(
    heightM: number,
    options: Flight3dCursorRenderOptions
  ): number {
    return (
      options.trackAltitudeOffsetM +
      options.verticalExaggerationRelativeHeight +
      (heightM - options.verticalExaggerationRelativeHeight) *
        options.verticalExaggeration
    );
  }
}