import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  PublicFlight,
  PublicFlightDetailsDto,
  PublicFlightsPage,
} from '../models/public-flight.model';

@Injectable({
  providedIn: 'root',
})
export class PublicFlightsApiService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/api/public/flights';

  getPublicFlights() {
    return this.http.get<PublicFlightsPage>(this.baseUrl);
  }

  getPublicFlight(flightId: string) {
    return this.http.get<PublicFlight>(`${this.baseUrl}/${flightId}`);
  }

  getPublicFlightDetails(flightId: string) {
    return this.http.get<PublicFlightDetailsDto>(
      `${this.baseUrl}/${flightId}/details`
    );
  }
}