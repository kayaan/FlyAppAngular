// src/app/features/flights/services/flight-settings-storage.service.ts

import { Injectable } from '@angular/core';
import {
  DEFAULT_FLIGHT_SETTINGS,
  FlightSettings,
} from '../models/flight-settings.model';

const STORAGE_KEY = 'flight-app.settings.v1';

@Injectable({
  providedIn: 'root',
})
export class FlightSettingsStorageService {
  load(): FlightSettings {
    const raw = localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return DEFAULT_FLIGHT_SETTINGS;
    }

    try {
      const parsed = JSON.parse(raw) as Partial<FlightSettings>;

      return {
        ...DEFAULT_FLIGHT_SETTINGS,
        ...parsed,
      };
    } catch {
      return DEFAULT_FLIGHT_SETTINGS;
    }
  }

  save(settings: FlightSettings): void {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  reset(): void {
    localStorage.removeItem(STORAGE_KEY);
  }
}