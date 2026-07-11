import { HttpErrorResponse } from '@angular/common/http';
import { Injectable } from '@angular/core';

import { AppError, AppErrorType } from './app-error';

interface BackendErrorResponse {
  message?: unknown;
  error?: unknown;
  code?: unknown;
  details?: unknown;
}

@Injectable({
  providedIn: 'root',
})
export class AppErrorService {
  fromHttpError(error: HttpErrorResponse): AppError {
    const backendError = this.readBackendError(error.error);

    return new AppError({
      type: this.getHttpErrorType(error.status),
      status: error.status,
      code: backendError.code,
      message:
        backendError.message ??
        this.getDefaultHttpMessage(error.status),
      details: backendError.details ?? error.error,
      cause: error,
    });
  }

  normalize(
    error: unknown,
    fallbackMessage = 'An unexpected error occurred.'
  ): AppError {
    if (error instanceof AppError) {
      return error;
    }

    if (error instanceof HttpErrorResponse) {
      return this.fromHttpError(error);
    }

    if (error instanceof Error) {
      return new AppError({
        type: 'unknown',
        message: error.message || fallbackMessage,
        cause: error,
      });
    }

    return new AppError({
      type: 'unknown',
      message: fallbackMessage,
      details: error,
      cause: error,
    });
  }

  getMessage(error: unknown, fallbackMessage: string): string {
    const appError = this.normalize(error, fallbackMessage);

    return appError.message || fallbackMessage;
  }

  isUnauthorized(error: unknown): boolean {
    const appError = this.normalize(error);

    return (
      appError.type === 'unauthorized' ||
      appError.status === 401
    );
  }

  isForbidden(error: unknown): boolean {
    const appError = this.normalize(error);

    return (
      appError.type === 'forbidden' ||
      appError.status === 403
    );
  }

  isNotFound(error: unknown): boolean {
    const appError = this.normalize(error);

    return (
      appError.type === 'not-found' ||
      appError.status === 404
    );
  }

  private getHttpErrorType(status: number): AppErrorType {
    switch (status) {
      case 0:
        return 'network';

      case 401:
        return 'unauthorized';

      case 403:
        return 'forbidden';

      case 404:
        return 'not-found';

      case 409:
        return 'conflict';

      case 400:
      case 422:
        return 'validation';

      default:
        return status >= 500 ? 'server' : 'unknown';
    }
  }

  private getDefaultHttpMessage(status: number): string {
    switch (status) {
      case 0:
        return 'The server could not be reached.';

      case 400:
        return 'The request is invalid.';

      case 401:
        return 'You are not logged in.';

      case 403:
        return 'You do not have permission for this action.';

      case 404:
        return 'The requested resource was not found.';

      case 409:
        return 'The request conflicts with the current state.';

      case 422:
        return 'The submitted data is invalid.';

      default:
        return status >= 500
          ? 'A server error occurred.'
          : 'The request could not be completed.';
    }
  }

  private readBackendError(value: unknown): {
    message: string | null;
    code: string | null;
    details: unknown;
  } {
    if (typeof value === 'string') {
      const message = value.trim();

      return {
        message: message || null,
        code: null,
        details: null,
      };
    }

    if (!value || typeof value !== 'object') {
      return {
        message: null,
        code: null,
        details: null,
      };
    }

    const response = value as BackendErrorResponse;

    return {
      message:
        this.readString(response.message) ??
        this.readString(response.error),
      code: this.readString(response.code),
      details: response.details,
    };
  }

  private readString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }

    const text = value.trim();

    return text || null;
  }
}