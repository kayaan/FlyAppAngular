// src/app/features/flights/services/backend-flights-api.service.ts

import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import { BackendFlight } from '../models/backend-flight.model';

@Injectable({
  providedIn: 'root',
})
export class BackendFlightsApiService {
  private readonly http = inject(HttpClient);

  getFlights() {
    return this.http.get<BackendFlight[]>('/api/flights');
  }
}