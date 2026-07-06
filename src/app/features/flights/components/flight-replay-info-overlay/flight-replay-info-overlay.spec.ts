import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightReplayInfoOverlayData } from './flight-replay-info-overlay-data';

describe('FlightReplayInfoOverlayData', () => {
  let component: FlightReplayInfoOverlayData;
  let fixture: ComponentFixture<FlightReplayInfoOverlayData>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightReplayInfoOverlayData],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightReplayInfoOverlayData);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
