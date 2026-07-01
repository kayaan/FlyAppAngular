import { Injectable } from '@angular/core';

export interface FlightSyncEvent {
  type: 'connected' | 'uploaded' | 'deleted' | 'visibilityChanged' | string;
  flightId: string | null;
}

@Injectable({
  providedIn: 'root',
})
export class FlightSyncEventsService {
  connect(onFlightChanged: (event: FlightSyncEvent) => void): EventSource | null {
    if (typeof EventSource === 'undefined') {
      console.warn('EventSource is not supported in this environment.');
      return null;
    }

    const source = new EventSource('/api/flights/sync/events', {
      withCredentials: true,
    });

    source.addEventListener('connected', (event) => {
      const syncEvent = this.parseEvent(event);

      console.debug('Flight sync SSE connected', syncEvent);
    });

    source.addEventListener('flightChanged', (event) => {
      const syncEvent = this.parseEvent(event);

      if (!syncEvent) {
        return;
      }

      console.debug('Flight sync event received', syncEvent);

      onFlightChanged(syncEvent);
    });

    source.onerror = (error) => {
      console.warn('Flight sync SSE connection error', error);
    };

    return source;
  }

  private parseEvent(event: Event): FlightSyncEvent | null {
    const messageEvent = event as MessageEvent<string>;

    if (!messageEvent.data) {
      return null;
    }

    try {
      return JSON.parse(messageEvent.data) as FlightSyncEvent;
    } catch (error) {
      console.warn('Could not parse flight sync SSE event', error);
      return null;
    }
  }
}