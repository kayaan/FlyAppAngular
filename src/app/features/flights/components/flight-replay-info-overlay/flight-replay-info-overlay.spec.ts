import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FlightReplayInfoOverlay  } from './flight-replay-info-overlay';



describe('FlightReplayInfoOverlayData', () => {
  let component: FlightReplayInfoOverlay;
  let fixture: ComponentFixture<FlightReplayInfoOverlay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FlightReplayInfoOverlay],
    }).compileComponents();

    fixture = TestBed.createComponent(FlightReplayInfoOverlay);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
