import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightClimbsPanel } from './flight-climbs-panel';

describe('FlightClimbsPanel', () => {
  let component: FlightClimbsPanel;
  let fixture: ComponentFixture<FlightClimbsPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightClimbsPanel],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightClimbsPanel);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
