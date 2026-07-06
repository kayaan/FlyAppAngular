import { Injectable } from '@angular/core';

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

export interface Flight3dSelectedClimbRenderOptions {
  renderStep: number;
  trackAltitudeOffsetM: number;
  verticalExaggeration: number;
  verticalExaggerationRelativeHeight: number;
}

@Injectable()
export class Flight3dSelectedClimbRendererService {
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

    const pointCount = this.getPointCount(track);

    if (pointCount < 2) {
      return;
    }

    const start = Math.max(0, Math.min(startIndex, endIndex));
    const end = Math.min(pointCount - 1, Math.max(startIndex, endIndex));

    const positions: Cartesian3[] = [];
    const step = Math.max(1, Math.round(options.renderStep));

    for (let i = start; i <= end; i += step) {
      const position = this.buildPosition(track, i, options);

      if (position) {
        positions.push(position);
      }
    }

    const lastPosition = this.buildPosition(track, end, options);

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

  private buildPosition(
    track: TrackArrays,
    index: number,
    options: Flight3dSelectedClimbRenderOptions
  ): Cartesian3 | null {
    const lat = track.latE7[index] / 10_000_000;
    const lon = track.lonE7[index] / 10_000_000;
    const rawAltitudeM = track.altGpsCm[index] / 100;
    const altitudeM = this.exaggerateHeight(rawAltitudeM, options);

    if (
      !Number.isFinite(lat) ||
      !Number.isFinite(lon) ||
      !Number.isFinite(altitudeM)
    ) {
      return null;
    }

    if (lat === 0 && lon === 0) {
      return null;
    }

    return Cartesian3.fromDegrees(lon, lat, altitudeM);
  }

  private exaggerateHeight(
    heightM: number,
    options: Flight3dSelectedClimbRenderOptions
  ): number {
    return (
      options.trackAltitudeOffsetM +
      options.verticalExaggerationRelativeHeight +
      (heightM - options.verticalExaggerationRelativeHeight) *
        options.verticalExaggeration
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
}