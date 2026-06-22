import { Injectable } from '@angular/core';

import { BackendFlight } from '../models/backend-flight.model';
import { FlightListItem } from '../models/flight-list-item.model';
import { LocalFlightListItem } from '../data-access/flight-storage.interface';

@Injectable({
  providedIn: 'root',
})
export class FlightListMergeService {
  merge(
    localItems: LocalFlightListItem[],
    backendFlights: BackendFlight[]
  ): FlightListItem[] {
    const itemsById = new Map<string, FlightListItem>();

    for (const localItem of localItems) {
      itemsById.set(localItem.flight.id, {
        id: localItem.flight.id,
        localFlight: localItem.flight,
        backendFlight: null,
        localStats: localItem.stats,
        syncStatus: 'localOnly',
      });
    }

    for (const backendFlight of backendFlights) {
      const existing = itemsById.get(backendFlight.id);

      if (existing) {
        itemsById.set(backendFlight.id, {
          ...existing,
          backendFlight,
          syncStatus: 'synced',
        });
      } else {
        itemsById.set(backendFlight.id, {
          id: backendFlight.id,
          localFlight: null,
          backendFlight,
          localStats: null,
          syncStatus: 'remoteOnly',
        });
      }
    }

    return Array.from(itemsById.values()).sort((a, b) => {
      const aDate =
        a.localFlight?.flightDate ??
        a.backendFlight?.flightDate ??
        a.localFlight?.importedAtUtc ??
        a.backendFlight?.importedAtUtc ??
        '';

      const bDate =
        b.localFlight?.flightDate ??
        b.backendFlight?.flightDate ??
        b.localFlight?.importedAtUtc ??
        b.backendFlight?.importedAtUtc ??
        '';

      return bDate.localeCompare(aDate);
    });
  }
}