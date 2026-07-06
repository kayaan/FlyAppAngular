import { Injectable, inject } from '@angular/core';

import {
    Cartesian2,
    SceneTransforms,
    ScreenSpaceEventHandler,
    ScreenSpaceEventType,
    Viewer,
} from 'cesium';

import { TrackArrays } from '../../../models/track-arrays.model';

import {
    Flight3dPositionOptions,
    Flight3dPositionService,
} from './flight-3d-position.service';

export interface Flight3dPickingOptions extends Flight3dPositionOptions {
    renderStep: number;
    maxPixelDistance: number;
}

@Injectable()
export class Flight3dPickingService {
    private readonly positionService = inject(Flight3dPositionService);

    private viewer: Viewer | null = null;
    private mouseMoveHandler: ScreenSpaceEventHandler | null = null;

    attach(
        viewer: Viewer,
        onTrackHover: (screenPosition: Cartesian2) => void
    ): void {
        this.viewer = viewer;

        this.mouseMoveHandler?.destroy();
        this.mouseMoveHandler = new ScreenSpaceEventHandler(viewer.scene.canvas);

        this.mouseMoveHandler.setInputAction(
            (movement: { endPosition: Cartesian2 }) => {
                onTrackHover(movement.endPosition);
            },
            ScreenSpaceEventType.MOUSE_MOVE
        );
    }

    destroy(): void {
        this.mouseMoveHandler?.destroy();
        this.mouseMoveHandler = null;
        this.viewer = null;
    }

    findNearestTrackIndexByScreenPosition(
        track: TrackArrays,
        mousePosition: Cartesian2,
        options: Flight3dPickingOptions
    ): number | null {
        if (!this.viewer) {
            return null;
        }

        const pointCount = this.positionService.getPointCount(track);

        if (pointCount === 0) {
            return null;
        }

        let bestIndex: number | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        const step = Math.max(1, Math.round(options.renderStep));

        for (let i = 0; i < pointCount; i += step) {
            const worldPosition = this.positionService.buildPosition(
                track,
                i,
                options
            );

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

        if (bestIndex === null || bestDistance > options.maxPixelDistance) {
            return null;
        }

        return bestIndex;
    }
}