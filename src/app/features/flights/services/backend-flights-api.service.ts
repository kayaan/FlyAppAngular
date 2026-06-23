import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import {
  BackendFlight,
  CreateBackendFlightRequest,
} from '../models/backend-flight.model';
import { ImportBackendFlightRequest } from '../models/backend-flight-import.model';

@Injectable({
  providedIn: 'root',
})
export class BackendFlightsApiService {
  private readonly http = inject(HttpClient);

  private readonly baseUrl = '/api/flights';

  getFlights() {
    return this.http.get<BackendFlight[]>(this.baseUrl, {
      withCredentials: true,
    });
  }

  createFlight(request: CreateBackendFlightRequest) {
    return this.http.post<BackendFlight>(this.baseUrl, request, {
      withCredentials: true,
    });
  }

  uploadOriginalIgc(flightId: string, file: File) {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post(`${this.baseUrl}/${flightId}/igc`, formData, {
      withCredentials: true,
    });
  }

  downloadOriginalIgc(flightId: string) {
    return this.http.get(`${this.baseUrl}/${flightId}/igc`, {
      responseType: 'blob',
      withCredentials: true,
    });
  }

  importFlight(request: ImportBackendFlightRequest, file: File) {
    const formData = new FormData();

    formData.append(
      'metadata',
      new Blob([JSON.stringify(request)], {
        type: 'application/json',
      })
    );

    formData.append('file', file, file.name);

    return this.http.post<BackendFlight>(`${this.baseUrl}/import`, formData, {
      withCredentials: true,
    });
  }
}