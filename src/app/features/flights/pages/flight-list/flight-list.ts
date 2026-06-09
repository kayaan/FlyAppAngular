import { Component, ElementRef, ViewChild, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';

import { FlightsStore } from '../../store/flights.store';

@Component({
  selector: 'app-flight-list',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './flight-list.html',
  styleUrl: './flight-list.scss',
})
export class FlightList implements OnInit {
  readonly store = inject(FlightsStore);

  @ViewChild('fileInput')
  private fileInput?: ElementRef<HTMLInputElement>;

  /**
   * Load flights when the page opens.
   */
  ngOnInit(): void {
    void this.store.loadFlights();
  }

  /**
   * Opens the hidden file input.
   */
  openFileDialog(): void {
    this.fileInput?.nativeElement.click();
  }

  /**
   * Imports one or multiple selected IGC files.
   */
  async onFilesSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;

    if (!input.files || input.files.length === 0) {
      return;
    }

    await this.store.importFiles(input.files);

    // Reset input so selecting the same file again triggers change event.
    input.value = '';
  }

  /**
   * Deletes one flight.
   */
  async deleteFlight(flightId: number): Promise<void> {
    await this.store.deleteFlight(flightId);
  }
}