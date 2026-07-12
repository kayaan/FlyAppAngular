import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AppError } from './app-error';
import { AppErrorService } from './app-error.service';
import { GlobalErrorHandler } from './global-error-handler';

describe('GlobalErrorHandler', () => {
  let handler: GlobalErrorHandler;
  let errorService: AppErrorService;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        GlobalErrorHandler,
        AppErrorService,
      ],
    });

    handler = TestBed.inject(GlobalErrorHandler);
    errorService = TestBed.inject(AppErrorService);

    vi.restoreAllMocks();
  });

  it('should normalize and log an unhandled error', () => {
    const originalError = new Error('Unexpected failure.');

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const normalizeSpy = vi.spyOn(
      errorService,
      'normalize'
    );

    handler.handleError(originalError);

    expect(normalizeSpy).toHaveBeenCalledWith(
      originalError,
      'An unexpected application error occurred.'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Unhandled application error',
      expect.objectContaining({
        type: 'unknown',
        status: null,
        code: null,
        message: 'Unexpected failure.',
        cause: originalError,
      })
    );
  });

  it('should unwrap rejected promise errors', () => {
    const rejection = new Error('Promise rejected.');

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const normalizeSpy = vi.spyOn(
      errorService,
      'normalize'
    );

    handler.handleError({
      rejection,
    });

    expect(normalizeSpy).toHaveBeenCalledWith(
      rejection,
      'An unexpected application error occurred.'
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'Unhandled application error',
      expect.objectContaining({
        message: 'Promise rejected.',
        cause: rejection,
      })
    );
  });

  it('should preserve an existing AppError', () => {
    const appError = new AppError({
      type: 'server',
      status: 503,
      code: 'SERVICE_UNAVAILABLE',
      message: 'Service unavailable.',
      details: {
        retryAfterSec: 30,
      },
    });

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    handler.handleError(appError);

    expect(consoleSpy).toHaveBeenCalledWith(
      'Unhandled application error',
      {
        type: 'server',
        status: 503,
        code: 'SERVICE_UNAVAILABLE',
        message: 'Service unavailable.',
        details: {
          retryAfterSec: 30,
        },
        cause: undefined,
      }
    );
  });

  it('should use the fallback message for unknown values', () => {
    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    handler.handleError({
      unexpected: true,
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      'Unhandled application error',
      expect.objectContaining({
        type: 'unknown',
        status: null,
        message: 'An unexpected application error occurred.',
        details: {
          unexpected: true,
        },
      })
    );
  });

  it('should not unwrap ordinary objects without a rejection property', () => {
    const error = {
      message: 'Ordinary object',
    };

    const consoleSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const normalizeSpy = vi.spyOn(
      errorService,
      'normalize'
    );

    handler.handleError(error);

    expect(normalizeSpy).toHaveBeenCalledWith(
      error,
      'An unexpected application error occurred.'
    );

    expect(consoleSpy).toHaveBeenCalled();
  });
});