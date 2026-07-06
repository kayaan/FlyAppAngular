import { Injectable } from '@angular/core';

import {
    ArcType,
    Cartesian3,
    Color,
    ColorMaterialProperty,
    ConstantPositionProperty,
    ConstantProperty,
    Entity,
    HeightReference,
    PointGraphics,
    Viewer,
} from 'cesium';

import { ReplayRange } from '../../../models/replay-state.model';
import { TrackArrays } from '../../../models/track-arrays.model';

export interface Flight3dReplayRenderOptions {
    replayIndex: number;
    replayRange: ReplayRange | null;
    replayTrailDurationSec: number | null;

    renderStep: number;
    trackAltitudeOffsetM: number;
    verticalExaggeration: number;
    verticalExaggerationRelativeHeight: number;
}

@Injectable()
export class Flight3dReplayRendererService {
    private viewer: Viewer | null = null;

    private replayTrackEntity: Entity | null = null;

    private replayStartEntity: Entity | null = null;
    private replayCurrentEntity: Entity | null = null;
    private replayEndEntity: Entity | null = null;
    private replayCurrentPositionProperty: ConstantPositionProperty | null = null;

    attach(viewer: Viewer): void {
        this.viewer = viewer;
    }

    clear(): void {
        this.clearReplayTrackEntity();
        this.clearReplayStartEntity();
        this.clearReplayEndEntity();
        this.clearReplayCurrentEntity();
    }

    render(track: TrackArrays, options: Flight3dReplayRenderOptions): void {
        if (!this.viewer) {
            return;
        }

        this.updateReplayStartEntity(track, options);
        this.updateReplayEndEntity(track, options);
        this.updateReplayTrackEntity(track, options);
        this.updateReplayCurrentEntity(track, options);
    }

    private updateReplayCurrentEntity(
        track: TrackArrays,
        options: Flight3dReplayRenderOptions
    ): void {
        if (!this.viewer) {
            return;
        }

        const pointCount = this.getPointCount(track);

        if (pointCount === 0) {
            this.clearReplayCurrentEntity();
            return;
        }

        const safeReplayIndex = Math.max(
            0,
            Math.min(options.replayIndex, pointCount - 1)
        );

        const position = this.buildPosition(track, safeReplayIndex, options);

        if (!position) {
            this.clearReplayCurrentEntity();
            return;
        }

        if (!this.replayCurrentEntity || !this.replayCurrentPositionProperty) {
            this.replayCurrentPositionProperty =
                new ConstantPositionProperty(position);

            this.replayCurrentEntity = this.viewer.entities.add({
                name: 'Replay current position',
                position: this.replayCurrentPositionProperty,
                point: new PointGraphics({
                    pixelSize: new ConstantProperty(14),
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

        this.replayCurrentPositionProperty.setValue(position);
        this.replayCurrentEntity.show = true;
    }

    private clearReplayCurrentEntity(): void {
        this.replayCurrentPositionProperty = null;

        if (!this.viewer || !this.replayCurrentEntity) {
            this.replayCurrentEntity = null;
            return;
        }

        this.viewer.entities.remove(this.replayCurrentEntity);
        this.replayCurrentEntity = null;
    }

    private updateReplayStartEntity(
        track: TrackArrays,
        options: Flight3dReplayRenderOptions
    ): void {
        if (!this.viewer) {
            return;
        }

        const pointCount = this.getPointCount(track);

        if (pointCount === 0) {
            this.clearReplayStartEntity();
            return;
        }

        const range = this.normalizeReplayRange(options.replayRange, pointCount);
        const position = this.buildPosition(track, range.startIndex, options);

        if (!position) {
            this.clearReplayStartEntity();
            return;
        }

        if (!this.replayStartEntity) {
            this.replayStartEntity = this.viewer.entities.add({
                name: 'Replay start position',
                position: new ConstantPositionProperty(position),
                point: new PointGraphics({
                    pixelSize: new ConstantProperty(15),
                    color: new ConstantProperty(Color.LIME),
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

        this.replayStartEntity.position = new ConstantPositionProperty(position);
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
        options: Flight3dReplayRenderOptions
    ): void {
        if (!this.viewer) {
            return;
        }

        const pointCount = this.getPointCount(track);

        if (pointCount === 0) {
            this.clearReplayEndEntity();
            return;
        }

        const range = this.normalizeReplayRange(options.replayRange, pointCount);
        const position = this.buildPosition(track, range.endIndex, options);

        if (!position) {
            this.clearReplayEndEntity();
            return;
        }

        if (!this.replayEndEntity) {
            this.replayEndEntity = this.viewer.entities.add({
                name: 'Replay end position',
                position: new ConstantPositionProperty(position),
                point: new PointGraphics({
                    pixelSize: new ConstantProperty(15),
                    color: new ConstantProperty(Color.RED),
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

        this.replayEndEntity.position = new ConstantPositionProperty(position);
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
        options: Flight3dReplayRenderOptions
    ): void {
        if (!this.viewer) {
            return;
        }

        const pointCount = this.getPointCount(track);

        if (pointCount < 2) {
            this.clearReplayTrackEntity();
            return;
        }

        const range = this.normalizeReplayRange(options.replayRange, pointCount);

        const safeReplayIndex = Math.max(
            range.startIndex,
            Math.min(options.replayIndex, range.endIndex)
        );

        let trailStartIndex = range.startIndex;

        if (options.replayTrailDurationSec !== null) {
            const currentFlightSec = track.timeSec[safeReplayIndex];
            const minTrailTimeSec = currentFlightSec - options.replayTrailDurationSec;

            trailStartIndex = Math.max(
                range.startIndex,
                this.findIndexAtOrAfterTime(track.timeSec, minTrailTimeSec)
            );
        }

        const positions: Cartesian3[] = [];
        const step = Math.max(1, Math.round(options.renderStep));

        for (let i = trailStartIndex; i <= safeReplayIndex; i += step) {
            const position = this.buildPosition(track, i, options);

            if (position) {
                positions.push(position);
            }
        }

        const lastPosition = this.buildPosition(track, safeReplayIndex, options);

        if (lastPosition) {
            positions.push(lastPosition);
        }

        if (positions.length < 2) {
            return;
        }

        if (!this.replayTrackEntity) {
            this.replayTrackEntity = this.viewer.entities.add({
                name: 'Replay track',
                polyline: {
                    positions,
                    width: new ConstantProperty(4),
                    material: new ColorMaterialProperty(
                        Color.fromCssColorString('#ff7a00').withAlpha(1.0)
                    ),
                    clampToGround: false,
                    arcType: ArcType.NONE,
                },
            });

            return;
        }

        this.replayTrackEntity.polyline!.positions =
            new ConstantProperty(positions);
    }

    private clearReplayTrackEntity(): void {

        if (!this.viewer || !this.replayTrackEntity) {
            this.replayTrackEntity = null;
            return;
        }

        this.viewer.entities.remove(this.replayTrackEntity);
        this.replayTrackEntity = null;
    }

    private buildPosition(
        track: TrackArrays,
        index: number,
        options: Flight3dReplayRenderOptions
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
        options: Flight3dReplayRenderOptions
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