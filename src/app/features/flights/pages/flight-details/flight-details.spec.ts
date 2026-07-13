import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FlightDetails } from './flight-details';

describe('FlightDetails', () => {
  let component: FlightDetails;
  let fixture: ComponentFixture<FlightDetails>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightDetails],
      providers: [
        provideRouter([]),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightDetails);
    component = fixture.componentInstance;
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});