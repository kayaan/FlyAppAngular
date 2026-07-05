import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';

import {
  PublicFlightDetailsDto,
  PublicFlightsPage,
} from '../models/public-flight.model';

export type PublicFlightSort =
  | 'date'
  | 'pilot'
  | 'glider'
  | 'duration'
  | 'distance'
  | 'minAltGps'
  | 'maxAltGps';

export type PublicFlightSortDirection = 'asc' | 'desc';

export interface PublicFlightsQuery {
  q?: string | null;
  from?: string | null;
  to?: string | null;
  sort?: PublicFlightSort;
  direction?: PublicFlightSortDirection;
  page?: number;
  size?: number;
}

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

    if (query.direction) {
      params = params.set('direction', query.direction);
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