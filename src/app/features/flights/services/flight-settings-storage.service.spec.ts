import { beforeEach, describe, expect, it } from 'vitest';

import {
  DEFAULT_FLIGHT_SETTINGS,
  FlightSettings,
} from '../models/flight-settings.model';
import { FlightSettingsStorageService } from './flight-settings-storage.service';

const STORAGE_KEY = 'flight-app.settings.v1';

describe('FlightSettingsStorageService', () => {
  let service: FlightSettingsStorageService;

  beforeEach(() => {
    localStorage.clear();
    service = new FlightSettingsStorageService();
  });

  it('should return default settings when storage is empty', () => {
    const result = service.load();

    expect(result).toEqual(DEFAULT_FLIGHT_SETTINGS);
  });

  it('should save all settings as JSON', () => {
    const settings: FlightSettings = {
      ...DEFAULT_FLIGHT_SETTINGS,
      mapTileMode: 'osm',
      chartHeightMode: 'large',
      trackColorMode: 'speed',
      showStatsPanel: true,
      showClimbsOnCharts: true,
      altitudeChartResolutionInSec: 10,
    };

    service.save(settings);

    expect(localStorage.getItem(STORAGE_KEY)).toBe(
      JSON.stringify(settings)
    );
  });

  it('should load previously saved settings', () => {
    const settings: FlightSettings = {
      ...DEFAULT_FLIGHT_SETTINGS,
      mapTileMode: 'osm',
      showAltitudeChart: false,
      showSpeedChart: false,
      trackColorMode: 'speed',
      threeDVerticalExaggeration: 3,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(settings)
    );

    expect(service.load()).toEqual(settings);
  });

  it('should merge partial stored settings with defaults', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mapTileMode: 'osm',
        showStatsPanel: true,
        trackColorMode: 'speed',
      })
    );

    const result = service.load();

    expect(result).toEqual({
      ...DEFAULT_FLIGHT_SETTINGS,
      mapTileMode: 'osm',
      showStatsPanel: true,
      trackColorMode: 'speed',
    });
  });

  it('should let stored values override default values', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showAltitudeChart: false,
        chartHeightMode: 'compact',
        varioChartResolutionInSec: 15,
      })
    );

    const result = service.load();

    expect(result.showAltitudeChart).toBe(false);
    expect(result.chartHeightMode).toBe('compact');
    expect(result.varioChartResolutionInSec).toBe(15);
  });

  it('should return defaults when stored JSON is invalid', () => {
    localStorage.setItem(
      STORAGE_KEY,
      '{this is not valid json'
    );

    const result = service.load();

    expect(result).toEqual(DEFAULT_FLIGHT_SETTINGS);
  });

  it('should return defaults when stored value is empty', () => {
    localStorage.setItem(STORAGE_KEY, '');

    expect(service.load()).toEqual(DEFAULT_FLIGHT_SETTINGS);
  });

  it('should remove stored settings on reset', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showStatsPanel: true,
      })
    );

    service.reset();

    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
    expect(service.load()).toEqual(DEFAULT_FLIGHT_SETTINGS);
  });

  it('should not modify the default settings object when loading partial settings', () => {
    const defaultsBefore = {
      ...DEFAULT_FLIGHT_SETTINGS,
    };

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showStatsPanel: true,
        mapTileMode: 'osm',
      })
    );

    service.load();

    expect(DEFAULT_FLIGHT_SETTINGS).toEqual(defaultsBefore);
  });

  it('should return a new object when stored settings exist', () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        showStatsPanel: true,
      })
    );

    const result = service.load();

    expect(result).not.toBe(DEFAULT_FLIGHT_SETTINGS);
  });

  it('should preserve all numeric 3D settings', () => {
    const settings: FlightSettings = {
      ...DEFAULT_FLIGHT_SETTINGS,
      threeDVerticalExaggeration: 4,
      threeDVerticalExaggerationRelativeHeight: 800,
      threeDTrackAltitudeOffsetM: 120,
      threeDRenderStep: 5,
      threeDVarioClassCount: 16,
      threeDMaxVarioForColorMs: 6,
    };

    service.save(settings);

    const result = service.load();

    expect(result.threeDVerticalExaggeration).toBe(4);
    expect(result.threeDVerticalExaggerationRelativeHeight).toBe(800);
    expect(result.threeDTrackAltitudeOffsetM).toBe(120);
    expect(result.threeDRenderStep).toBe(5);
    expect(result.threeDVarioClassCount).toBe(16);
    expect(result.threeDMaxVarioForColorMs).toBe(6);
  });
});