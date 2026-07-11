import {
  HttpErrorResponse,
  HttpInterceptorFn,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, throwError } from 'rxjs';

import { AppErrorService } from './app-error.service';

export const httpErrorInterceptor: HttpInterceptorFn = (
  request,
  next
) => {
  const errorService = inject(AppErrorService);

  return next(request).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse)) {
        return throwError(() =>
          errorService.normalize(
            error,
            'The request could not be completed.'
          )
        );
      }

      return throwError(() => errorService.fromHttpError(error));
    })
  );
};