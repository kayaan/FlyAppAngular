import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root',
})
export class BackendAvailabilityService {
  private readonly checkedSignal = signal(false);
  private readonly availableSignal = signal(false);

  readonly checked = this.checkedSignal.asReadonly();
  readonly available = this.availableSignal.asReadonly();

  private checkPromise: Promise<boolean> | null = null;

  async check(): Promise<boolean> {
    if (this.checkedSignal()) {
      return this.availableSignal();
    }

    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.checkPromise = this.checkBackend();

    const available = await this.checkPromise;

    this.availableSignal.set(available);
    this.checkedSignal.set(true);
    this.checkPromise = null;

    return available;
  }

  private async checkBackend(): Promise<boolean> {
    const controller = new AbortController();

    const timeoutId = window.setTimeout(() => {
      controller.abort();
    }, 800);

    try {
      const response = await fetch('/api/me', {
        method: 'GET',
        credentials: 'include',
        signal: controller.signal,
      });

      // Wichtig:
      // Wenn das Backend nicht läuft, liefert Vite beim Proxy-Fehler einen 500.
      // Das darf NICHT als "Backend verfügbar" gelten.
      if (response.status >= 500) {
        return false;
      }

      // Backend läuft:
      // 200 = User eingeloggt
      // 401/403 = Backend erreichbar, aber nicht eingeloggt/erlaubt
      // 302/redirect = Auth-Flow erreichbar
      return true;
    } catch {
      return false;
    } finally {
      window.clearTimeout(timeoutId);
    }
  }

  async checkFresh(): Promise<boolean> {
    if (this.checkPromise) {
      return this.checkPromise;
    }

    this.checkPromise = this.checkBackend();

    try {
      const available = await this.checkPromise;

      this.availableSignal.set(available);
      this.checkedSignal.set(true);

      return available;
    } finally {
      this.checkPromise = null;
    }
  }
}