import { Injectable } from '@angular/core';

import { FlightListItem } from '../models/flight-list-item.model';
import { FlightListSort, FlightSortKey } from '../models/flight-list-sort';

@Injectable({
  providedIn: 'root',
})
export class FlightListSortService {
  sort(items: FlightListItem[], sort: FlightListSort): FlightListItem[] {
    return [...items].sort((a, b) => {
      const result = this.compareByKey(a, b, sort.key);

      return sort.direction === 'asc' ? result : -result;
    });
  }

  private compareByKey(
    a: FlightListItem,
    b: FlightListItem,
    key: FlightSortKey
  ): number {
    switch (key) {
      case 'flightDate':
        return this.compareNullableString(
          this.getFlightDateSortValue(a),
          this.getFlightDateSortValue(b)
        );

      case 'pilot':
        return this.compareNullableString(
          a.localFlight?.pilot ?? a.backendFlight?.pilot,
          b.localFlight?.pilot ?? b.backendFlight?.pilot
        );

      case 'glider':
        return this.compareNullableString(
          a.localFlight?.glider ?? a.backendFlight?.glider,
          b.localFlight?.glider ?? b.backendFlight?.glider
        );

      case 'durationSec':
        return this.compareNullableNumber(
          a.localStats?.durationSec,
          b.localStats?.durationSec
        );

      case 'distanceM':
        return this.compareNullableNumber(
          a.localStats?.distanceM,
          b.localStats?.distanceM
        );

      case 'minAltGpsM':
        return this.compareNullableNumber(
          a.localStats?.minAltGpsM,
          b.localStats?.minAltGpsM
        );

      case 'maxAltGpsM':
        return this.compareNullableNumber(
          a.localStats?.maxAltGpsM,
          b.localStats?.maxAltGpsM
        );

      case 'syncStatus':
        return this.compareNullableString(a.syncStatus, b.syncStatus);
    }
  }

  private getFlightDateSortValue(item: FlightListItem): string | null {
    return (
      item.localFlight?.flightDate ??
      item.backendFlight?.flightDate ??
      item.localFlight?.importedAtUtc ??
      item.backendFlight?.importedAtUtc ??
      null
    );
  }

  private compareNullableString(
    a: string | null | undefined,
    b: string | null | undefined
  ): number {
    const av = a?.trim() || null;
    const bv = b?.trim() || null;

    if (av === null && bv === null) {
      return 0;
    }

    if (av === null) {
      return 1;
    }

    if (bv === null) {
      return -1;
    }

    return av.localeCompare(bv);
  }

  private compareNullableNumber(
    a: number | null | undefined,
    b: number | null | undefined
  ): number {
    if (a == null && b == null) {
      return 0;
    }

    if (a == null) {
      return 1;
    }

    if (b == null) {
      return -1;
    }

    return a - b;
  }
}