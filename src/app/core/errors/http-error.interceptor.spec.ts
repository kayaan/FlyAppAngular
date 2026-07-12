import {
  HttpClient,
  provideHttpClient,
  withInterceptors,
} from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';

import {
  EnvironmentInjector,
  runInInjectionContext,
} from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { firstValueFrom, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppError } from './app-error';
import { httpErrorInterceptor } from './http-error.interceptor';

describe('httpErrorInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(
          withInterceptors([httpErrorInterceptor])
        ),
        provideHttpClientTesting(),
      ],
    });

    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should pass successful responses through unchanged', async () => {
    const responsePromise = firstValueFrom(
      http.get<{ value: number }>('/api/test')
    );

    const request = httpTesting.expectOne('/api/test');

    request.flush({
      value: 42,
    });

    await expect(responsePromise).resolves.toEqual({
      value: 42,
    });
  });

  it('should convert a backend HTTP error to AppError', async () => {
    const responsePromise = firstValueFrom(
      http.get('/api/flights')
    );

    const request = httpTesting.expectOne('/api/flights');

    request.flush(
      {
        message: 'Flight could not be found.',
        code: 'FLIGHT_NOT_FOUND',
        details: {
          flightId: 'flight-1',
        },
      },
      {
        status: 404,
        statusText: 'Not Found',
      }
    );

    await expect(responsePromise).rejects.toMatchObject({
      name: 'AppError',
      type: 'not-found',
      status: 404,
      code: 'FLIGHT_NOT_FOUND',
      message: 'Flight could not be found.',
      details: {
        flightId: 'flight-1',
      },
    });
  });

  it('should use the default message when the backend has no message', async () => {
    const responsePromise = firstValueFrom(
      http.post('/api/flights', {})
    );

    const request = httpTesting.expectOne('/api/flights');

    request.flush(
      null,
      {
        status: 500,
        statusText: 'Internal Server Error',
      }
    );

    await expect(responsePromise).rejects.toMatchObject({
      name: 'AppError',
      type: 'server',
      status: 500,
      code: null,
      message: 'A server error occurred.',
    });
  });

  it('should map status zero to a network error', async () => {
    const responsePromise = firstValueFrom(
      http.get('/api/me')
    );

    const request = httpTesting.expectOne('/api/me');

    request.error(
      new ProgressEvent('error'),
      {
        status: 0,
        statusText: 'Unknown Error',
      }
    );

    await expect(responsePromise).rejects.toMatchObject({
      name: 'AppError',
      type: 'network',
      status: 0,
      message: 'The server could not be reached.',
    });
  });

  it('should preserve the original HttpErrorResponse as cause', async () => {
    const responsePromise = firstValueFrom(
      http.delete('/api/flights/flight-1')
    );

    const request = httpTesting.expectOne(
      '/api/flights/flight-1'
    );

    request.flush(
      {
        message: 'Conflict',
      },
      {
        status: 409,
        statusText: 'Conflict',
      }
    );

    try {
      await responsePromise;

      throw new Error('Expected request to fail.');
    } catch (error) {
      expect(error).toBeInstanceOf(AppError);

      const appError = error as AppError;

      expect(appError.type).toBe('conflict');
      expect(appError.status).toBe(409);

      expect(appError.cause).toMatchObject({
        status: 409,
        statusText: 'Conflict',
        url: '/api/flights/flight-1',
      });
    }
  });

  it('should normalize a non-HTTP error returned by the next handler', async () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const originalError = new Error('Unexpected client failure.');

    const result$ = runInInjectionContext(
      injector,
      () =>
        httpErrorInterceptor(
          {
            method: 'GET',
            url: '/api/test',
          } as never,
          () => throwError(() => originalError)
        )
    );

    await expect(firstValueFrom(result$)).rejects.toMatchObject({
      name: 'AppError',
      type: 'unknown',
      status: null,
      message: 'Unexpected client failure.',
      cause: originalError,
    });
  });

  it('should use the interceptor fallback for an empty normal Error', async () => {
    const injector = TestBed.inject(EnvironmentInjector);
    const originalError = new Error('');

    const result$ = runInInjectionContext(
      injector,
      () =>
        httpErrorInterceptor(
          {
            method: 'GET',
            url: '/api/test',
          } as never,
          () => throwError(() => originalError)
        )
    );

    await expect(firstValueFrom(result$)).rejects.toMatchObject({
      name: 'AppError',
      type: 'unknown',
      message: 'The request could not be completed.',
      cause: originalError,
    });
  });
});