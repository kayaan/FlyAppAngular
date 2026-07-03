import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  PublicFlightDetailsDto,
  PublicFlightsPage,
} from '../models/public-flight.model';

export interface PublicFlightsQuery {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: 'newest' | 'distance' | 'duration' | 'gain';
  page?: number;
  size?: number;
}

export type PublicFlightSort = 'newest' | 'distance' | 'duration' | 'gain';

@Injectable({
  providedIn: 'root',
})
export class PublicFlightsApiService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/api/public/flights';

  getPublicFlights(query: PublicFlightsQuery = {}) {
    let params = new HttpParams();

    if (query.q?.trim()) {
      params = params.set('q', query.q.trim());
    }

    if (query.from) {
      params = params.set('from', query.from);
    }

    if (query.to) {
      params = params.set('to', query.to);
    }

    if (query.sort) {
      params = params.set('sort', query.sort);
    }

    if (query.page !== undefined) {
      params = params.set('page', query.page);
    }

    if (query.size !== undefined) {
      params = params.set('size', query.size);
    }

    return this.http.get<PublicFlightsPage>(this.baseUrl, { params });
  }

  getPublicFlightDetails(flightId: string) {
    return this.http.get<PublicFlightDetailsDto>(
      `${this.baseUrl}/${flightId}/details`
    );
  }
}