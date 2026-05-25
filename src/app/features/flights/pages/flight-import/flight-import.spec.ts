import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightImport } from './flight-import';

describe('FlightImport', () => {
  let component: FlightImport;
  let fixture: ComponentFixture<FlightImport>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightImport],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightImport);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
