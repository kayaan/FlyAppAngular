import { Injectable } from '@angular/core';

export interface FlightSyncEvent {
  type:
    | 'connected'
    | 'uploaded'
    | 'deleted'
    | 'visibilityChanged'
    | string;

  flightId: string | null;
}

export type FlightSyncConnectionState =
  | 'connected'
  | 'disconnected'
  | 'unsupported';

export interface FlightSyncEventCallbacks {
  onFlightChanged: (event: FlightSyncEvent) => void;
  onConnectionStateChanged?: (
    state: FlightSyncConnectionState
  ) => void;
}

@Injectable({
  providedIn: 'root',
})
export class FlightSyncEventsService {
  connect(
    callbacks: FlightSyncEventCallbacks
  ): EventSource | null {
    if (typeof EventSource === 'undefined') {
      callbacks.onConnectionStateChanged?.('unsupported');
      return null;
    }

    const source = new EventSource(
      '/api/flights/sync/events',
      {
        withCredentials: true,
      }
    );

    source.addEventListener('connected', (event) => {
      const syncEvent = this.parseEvent(event);

      if (!syncEvent) {
        return;
      }

      callbacks.onConnectionStateChanged?.('connected');
    });

    source.addEventListener(
      'flightChanged',
      (event) => {
        const syncEvent = this.parseEvent(event);

        if (!syncEvent) {
          return;
        }

        callbacks.onFlightChanged(syncEvent);
      }
    );

    source.onerror = () => {
      if (source.readyState === EventSource.CLOSED) {
        callbacks.onConnectionStateChanged?.(
          'disconnected'
        );
      }
    };

    return source;
  }

  private parseEvent(
    event: Event
  ): FlightSyncEvent | null {
    const messageEvent = event as MessageEvent<unknown>;

    if (typeof messageEvent.data !== 'string') {
      return null;
    }

    const rawData = messageEvent.data.trim();

    if (!rawData) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawData) as unknown;

      return this.isFlightSyncEvent(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }

  private isFlightSyncEvent(
    value: unknown
  ): value is FlightSyncEvent {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const event = value as {
      type?: unknown;
      flightId?: unknown;
    };

    return (
      typeof event.type === 'string' &&
      (
        typeof event.flightId === 'string' ||
        event.flightId === null
      )
    );
  }
}