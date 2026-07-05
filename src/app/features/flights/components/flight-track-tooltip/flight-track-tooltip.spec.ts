import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightTrackTooltip } from './flight-track-tooltip';

describe('FlightTrackTooltip', () => {
  let component: FlightTrackTooltip;
  let fixture: ComponentFixture<FlightTrackTooltip>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightTrackTooltip],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightTrackTooltip);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
