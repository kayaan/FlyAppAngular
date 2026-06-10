import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FlightSummaryTags } from './flight-summary-tags';

describe('FlightSummaryTags', () => {
  let component: FlightSummaryTags;
  let fixture: ComponentFixture<FlightSummaryTags>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightSummaryTags],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightSummaryTags);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
