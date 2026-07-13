import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { FlightDetailsStore } from '../../store/flight-details.store';
import { FlightSettingsStore } from '../../store/flight-settings.store';

import { FlightDetailsSettingsDrawer } from './flight-details-settings-drawer';

describe('FlightDetailsSettingsDrawer', () => {
  const detailsStoreMock = {
    recalculateTrackMetrics: vi.fn(),
  };

  const settingsStoreMock = {
    showAltitudeChart: vi.fn(() => true),
    showVarioChart: vi.fn(() => true),
    showSpeedChart: vi.fn(() => true),

    altitudeChartResolutionInSec: vi.fn(() => 5),
    varioChartResolutionInSec: vi.fn(() => 5),
    speedChartResolutionInSec: vi.fn(() => 5),

    setShowAltitudeChart: vi.fn(),
    setShowVarioChart: vi.fn(),
    setShowSpeedChart: vi.fn(),

    setAltitudeChartResolutionInSec: vi.fn(),
    setVarioChartResolutionInSec: vi.fn(),
    setSpeedChartResolutionInSec: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [FlightDetailsSettingsDrawer],
      providers: [
        {
          provide: FlightDetailsStore,
          useValue: detailsStoreMock,
        },
        {
          provide: FlightSettingsStore,
          useValue: settingsStoreMock,
        },
      ],
    }).compileComponents();
  });

  it('should create', () => {
    const fixture = TestBed.createComponent(
      FlightDetailsSettingsDrawer
    );

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should open and close the drawer', () => {
    const fixture = TestBed.createComponent(
      FlightDetailsSettingsDrawer
    );

    const component = fixture.componentInstance;

    expect(component.open()).toBe(false);

    component.openDrawer();

    expect(component.open()).toBe(true);

    component.closeDrawer();

    expect(component.open()).toBe(false);
  });

  it('should update altitude chart visibility', () => {
    const fixture = TestBed.createComponent(
      FlightDetailsSettingsDrawer
    );

    const component = fixture.componentInstance;

    component.setAltitudeChartVisible({
      target: {
        checked: false,
      },
    } as unknown as Event);

    expect(
      settingsStoreMock.setShowAltitudeChart
    ).toHaveBeenCalledWith(false);
  });

  it('should update vario chart visibility', () => {
    const fixture = TestBed.createComponent(
      FlightDetailsSettingsDrawer
    );

    const component = fixture.componentInstance;

    component.setVarioChartVisible({
      target: {
        checked: false,
      },
    } as unknown as Event);

    expect(
      settingsStoreMock.setShowVarioChart
    ).toHaveBeenCalledWith(false);
  });

  it('should update speed chart visibility', () => {
    const fixture = TestBed.createComponent(
      FlightDetailsSettingsDrawer
    );

    const component = fixture.componentInstance;

    component.setSpeedChartVisible({
      target: {
        checked: false,
      },
    } as unknown as Event);

    expect(
      settingsStoreMock.setShowSpeedChart
    ).toHaveBeenCalledWith(false);
  });
});