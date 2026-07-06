import { Injectable, inject } from '@angular/core';

import {
  Cartesian3,
  HeadingPitchRange,
  Math as CesiumMath,
  Matrix4,
  Viewer,
} from 'cesium';

import { TrackArrays } from '../../../models/track-arrays.model';

import {
  Flight3dPositionOptions,
  Flight3dPositionService,
} from './flight-3d-position.service';

export interface Flight3dReplayCameraOptions extends Flight3dPositionOptions {
  resetView: boolean;
}

@Injectable()
export class Flight3dReplayCameraService {
  private readonly positionService = inject(Flight3dPositionService);

  private viewer: Viewer | null = null;
  private smoothedCameraHeadingRad: number | null = null;

  attach(viewer: Viewer): void {
    this.viewer = viewer;
  }

  reset(): void {
    this.smoothedCameraHeadingRad = null;
  }

  follow(
    track: TrackArrays,
    replayIndex: number,
    options: Flight3dReplayCameraOptions
  ): void {
    if (!this.viewer) {
      return;
    }

    const pointCount = this.positionService.getPointCount(track);

    if (pointCount < 2) {
      return;
    }

    const safeIndex = Math.max(0, Math.min(replayIndex, pointCount - 1));

    const targetLat = track.latE7[safeIndex] / 10_000_000;
    const targetLon = track.lonE7[safeIndex] / 10_000_000;
    const targetAltM = this.positionService.exaggerateHeight(
      track.altGpsCm[safeIndex] / 100,
      options
    );

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

    const defaultPitch = CesiumMath.toRadians(-55);
    const defaultRangeM = 2600;

    const currentRangeM = Cartesian3.distance(
      this.viewer.camera.positionWC,
      targetPosition
    );

    const heading = options.resetView
      ? defaultHeading
      : this.viewer.camera.heading;

    const pitch = options.resetView
      ? defaultPitch
      : this.viewer.camera.pitch;

    const range =
      options.resetView || !Number.isFinite(currentRangeM) || currentRangeM < 100
        ? defaultRangeM
        : currentRangeM;

    this.viewer.camera.lookAt(
      targetPosition,
      new HeadingPitchRange(heading, pitch, range)
    );

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
}