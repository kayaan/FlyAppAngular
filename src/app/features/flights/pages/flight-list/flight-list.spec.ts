import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightList } from './flight-list';

describe('FlightList', () => {
  let component: FlightList;
  let fixture: ComponentFixture<FlightList>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightList],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightList);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
