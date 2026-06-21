import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CurrentUser } from '../models/current-user.model';

@Injectable({
  providedIn: 'root',
})
export class AuthApiService {
  private readonly http = inject(HttpClient);

  getMe(): Observable<CurrentUser> {
    return this.http.get<CurrentUser>('/api/me', {
      withCredentials: true,
    });
  }

  loginWithGoogle(): void {
    window.location.href = '/api/auth/login/google';
  }

  logout(): Observable<void> {
    return this.http.post<void>('/api/auth/logout', null, {
      withCredentials: true,
    });
  }
}