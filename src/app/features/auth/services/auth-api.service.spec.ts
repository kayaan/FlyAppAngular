import {
    provideHttpClient,
} from '@angular/common/http';
import {
    HttpTestingController,
    provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
} from 'vitest';

import { CurrentUser } from '../models/current-user.model';
import { AuthApiService } from './auth-api.service';

describe('AuthApiService', () => {
    let service: AuthApiService;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                AuthApiService,
                provideHttpClient(),
                provideHttpClientTesting(),
            ],
        });

        service = TestBed.inject(AuthApiService);
        httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpTesting.verify();
    });

    it('should load the current user', () => {
        const expectedUser: CurrentUser = {
            id: 'user-1',
            email: 'pilot@example.com',
            displayName: 'Test Pilot',
            avatarUrl: 'https://example.com/avatar.jpg',
            createdAtUtc: '2026-07-01T10:00:00Z',
            lastLoginAtUtc: '2026-07-12T08:00:00Z',
        };

        service.getMe().subscribe((user) => {
            expect(user).toEqual(expectedUser);
        });

        const request = httpTesting.expectOne('/api/me');

        expect(request.request.method).toBe('GET');
        expect(request.request.withCredentials).toBe(true);
        expect(request.request.body).toBeNull();

        request.flush(expectedUser);
    });
    
    it('should redirect to the Google login endpoint', () => {
        const locationMock = {
            href: '',
        };

        Object.defineProperty(window, 'location', {
            configurable: true,
            value: locationMock,
        });

        service.loginWithGoogle();

        expect(locationMock.href).toBe(
            '/api/auth/login/google'
        );
    });

    it('should send a logout request', () => {
        service.logout().subscribe((result) => {
            expect(result).toBeNull();
        });

        const request = httpTesting.expectOne(
            '/api/auth/logout'
        );

        expect(request.request.method).toBe('POST');
        expect(request.request.withCredentials).toBe(true);
        expect(request.request.body).toBeNull();

        request.flush(null);
    });
});