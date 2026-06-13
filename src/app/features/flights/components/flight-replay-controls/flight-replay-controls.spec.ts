import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightReplayControls } from './flight-replay-controls';

describe('FlightReplayControls', () => {
  let component: FlightReplayControls;
  let fixture: ComponentFixture<FlightReplayControls>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightReplayControls],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightReplayControls);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
