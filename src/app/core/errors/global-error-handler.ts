import { ErrorHandler, Injectable, inject } from '@angular/core';

import { AppErrorService } from './app-error.service';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  private readonly errorService = inject(AppErrorService);

  handleError(error: unknown): void {
    const unwrappedError = this.unwrapError(error);
    const appError = this.errorService.normalize(
      unwrappedError,
      'An unexpected application error occurred.'
    );

    console.error('Unhandled application error', {
      type: appError.type,
      status: appError.status,
      code: appError.code,
      message: appError.message,
      details: appError.details,
      cause: appError.cause,
});
  }

  private unwrapError(error: unknown): unknown {
    if (
      error &&
      typeof error === 'object' &&
      'rejection' in error
    ) {
      return (error as { rejection: unknown }).rejection;
    }

    return error;
  }
}