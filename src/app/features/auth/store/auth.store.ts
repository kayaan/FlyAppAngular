import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';

import { BackendAvailabilityService } from '../../../core/layout/app-shell/services/backend-availability.service';
import { AppErrorService } from '../../../core/errors/app-error.service';
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

    displayName: computed(
      () =>
        store.user()?.displayName ??
        store.user()?.email ??
        null
    ),
  })),

  withMethods(
    (
      store,
      authApi = inject(AuthApiService),
      backendAvailability = inject(BackendAvailabilityService),
      errorService = inject(AppErrorService)
    ) => ({
      async loadMe(): Promise<void> {
        const backendAvailable =
          await backendAvailability.check();

        if (!backendAvailable) {
          patchState(store, {
            user: null,
            loading: false,
            checked: true,
            error: null,
          });

          return;
        }

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
        } catch (error) {
          const notAuthenticated =
            errorService.isUnauthorized(error) ||
            errorService.isForbidden(error);

          patchState(store, {
            user: null,
            loading: false,
            checked: true,
            error: notAuthenticated
              ? null
              : errorService.getMessage(
                  error,
                  'Login status could not be loaded.'
                ),
          });
        }
      },

      loginWithGoogle(): void {
        authApi.loginWithGoogle();
      },

      async logout(): Promise<void> {
        patchState(store, {
          loading: true,
          error: null,
        });

        try {
          await firstValueFrom(authApi.logout());

          patchState(store, {
            user: null,
            loading: false,
            checked: true,
            error: null,
          });
        } catch (error) {
          patchState(store, {
            loading: false,
            error: errorService.getMessage(
              error,
              'Logout failed.'
            ),
          });
        }
      },

      clearError(): void {
        patchState(store, {
          error: null,
        });
      },

      clear(): void {
        patchState(store, initialState);
      },
    })
  )
);