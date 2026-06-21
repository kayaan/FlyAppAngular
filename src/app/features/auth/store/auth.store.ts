
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { CurrentUser } from '../models/current-user.model';
import { AuthApiService } from '../services/auth-api.service';

type AuthState = {
  user: CurrentUser | null;
  loading: boolean;
  checked: boolean;
  error: string | null;
};

const initialState: AuthState = {
  user: null,
  loading: false,
  checked: false,
  error: null,
};

export const AuthStore = signalStore(
  { providedIn: 'root' },

  withState(initialState),

  withComputed((store) => ({
    authenticated: computed(() => store.user() !== null),
    displayName: computed(() => store.user()?.displayName ?? store.user()?.email ?? null),
  })),

  withMethods((store, authApi = inject(AuthApiService)) => ({
    async loadMe(): Promise<void> {
      patchState(store, {
        loading: true,
        error: null,
      });

      try {
        const user = await firstValueFrom(authApi.getMe());

        patchState(store, {
          user,
          loading: false,
          checked: true,
          error: null,
        });
      } catch {
        patchState(store, {
          user: null,
          loading: false,
          checked: true,
          error: null,
        });
      }
    },

    loginWithGoogle(): void {
      authApi.loginWithGoogle();
    },

    async logout(): Promise<void> {
      try {
        await firstValueFrom(authApi.logout());
      } finally {
        patchState(store, {
          user: null,
          loading: false,
          checked: true,
          error: null,
        });
      }
    },

    clear(): void {
      patchState(store, initialState);
    },
  }))
);