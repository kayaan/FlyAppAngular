import { Injectable, inject } from '@angular/core';

import {
    ArcType,
    Cartesian3,
    Color,
    ColorMaterialProperty,
    Entity,
    HeightReference,
    Viewer,
    ConstantProperty
} from 'cesium';
import { Climb } from '../models/climb.model';
import { TrackColorService } from './track-color.service';
import { TrackArrays } from '../models/track-arrays.model';



export interface Flight3dTrackRenderOptions {
    trackAltitudeOffsetM: number;
    renderStep: number;
    varioClassCount: number;
    maxVarioForColorMs: number;
    showOnlySelectedClimbTrack: boolean;
    selectedClimbId: number | null;
    climbs: Climb[];
    trackColorMode: 'vario' | 'speed';
    shouldCenter: boolean;
}

@Injectable()
export class Flight3dTrackRendererService {
    private readonly trackColorService = inject(TrackColorService);

    private viewer: Viewer | null = null;
    private flightTrackEntities: Entity[] = [];

    attach(viewer: Viewer): void {
        this.viewer = viewer;
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

    hasRenderedTrack(): boolean {
        return this.flightTrackEntities.length > 0;
    }

    setGhostMode(enabled: boolean): void {
        for (const entity of this.flightTrackEntities) {
            const polyline = entity.polyline;

            if (!polyline) {
                continue;
            }

            polyline.material = new ColorMaterialProperty(
                enabled
                    ? Color.WHITE.withAlpha(0.22)
                    : Color.WHITE.withAlpha(0.95)
            );

            polyline.width = new ConstantProperty(enabled ? 2 : 4);
        }
    }

    renderTrack(
        track: TrackArrays | null,
        options: Flight3dTrackRenderOptions
    ): void {
        if (!this.viewer) {
            return;
        }

        this.clear();

        if (!track || track.timeSec.length < 2) {
            return;
        }

        if (options.showOnlySelectedClimbTrack && options.selectedClimbId !== null) {
            const climb = options.climbs.find((x) => x.id === options.selectedClimbId);

            if (!climb) {
                return;
            }

            this.renderTrackRange(
                track,
                climb.startIndex,
                climb.endIndex,
                Color.DODGERBLUE,
                options
            );

            if (options.shouldCenter) {
                this.zoomToTrack();
            }

            return;
        }

        this.renderFullTrack(track, options);

        if (options.shouldCenter) {
            this.zoomToTrack();
        }
    }

    private renderFullTrack(
        track: TrackArrays,
        options: Flight3dTrackRenderOptions
    ): void {
        const color =
            options.trackColorMode === 'speed'
                ? Color.ORANGE
                : Color.LIME;

        this.renderTrackRange(
            track,
            0,
            track.timeSec.length - 1,
            color,
            options
        );
    }

    private renderTrackRange(
        track: TrackArrays,
        startIndex: number,
        endIndex: number,
        color: Color,
        options: Flight3dTrackRenderOptions
    ): void {
        if (!this.viewer) {
            return;
        }

        const positions = this.buildPositions(
            track,
            startIndex,
            endIndex,
            options
        );

        if (positions.length < 2) {
            return;
        }

        const entity = this.viewer.entities.add({
            polyline: {
                positions,
                width: 4,
                material: new ColorMaterialProperty(color.withAlpha(0.95)),
                clampToGround: false,
                arcType: ArcType.NONE,
            },
        });

        this.flightTrackEntities.push(entity);
    }

    private buildPositions(
        track: TrackArrays,
        startIndex: number,
        endIndex: number,
        options: Flight3dTrackRenderOptions
    ): Cartesian3[] {
        const positions: Cartesian3[] = [];

        const safeStartIndex = Math.max(0, Math.min(startIndex, endIndex));
        const safeEndIndex = Math.min(
            track.timeSec.length - 1,
            Math.max(startIndex, endIndex)
        );

        const step = Math.max(1, options.renderStep);

        for (let i = safeStartIndex; i <= safeEndIndex; i += step) {
            const lat = track.latE7[i] / 10_000_000;
            const lon = track.lonE7[i] / 10_000_000;
            const altitudeM = track.altGpsCm[i] / 100 + options.trackAltitudeOffsetM;

            if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
                continue;
            }

            if (lat === 0 && lon === 0) {
                continue;
            }

            positions.push(Cartesian3.fromDegrees(lon, lat, altitudeM));
        }

        return positions;
    }

    private zoomToTrack(): void {
        if (!this.viewer || this.flightTrackEntities.length === 0) {
            return;
        }

        void this.viewer.zoomTo(this.flightTrackEntities);
    }
}