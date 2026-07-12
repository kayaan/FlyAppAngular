import { HttpErrorResponse } from '@angular/common/http';
import { beforeEach, describe, expect, it } from 'vitest';

import { AppErrorService } from './app-error.service';
import { AppError } from './app-error';

describe('AppErrorService', () => {
    let service: AppErrorService;

    beforeEach(() => {
        service = new AppErrorService();
    });

    describe('fromHttpError', () => {
        it.each([
            [0, 'network'],
            [400, 'validation'],
            [401, 'unauthorized'],
            [403, 'forbidden'],
            [404, 'not-found'],
            [409, 'conflict'],
            [422, 'validation'],
            [500, 'server'],
            [503, 'server'],
            [418, 'unknown'],
        ] as const)(
            'should map HTTP status %s to error type %s',
            (status, expectedType) => {
                const httpError = createHttpError(status);

                const result = service.fromHttpError(httpError);

                expect(result.type).toBe(expectedType);
                expect(result.status).toBe(status);
                expect(result.cause).toBe(httpError);
            }
        );

        it('should use backend message, code and details', () => {
            const details = {
                field: 'email',
                reason: 'invalid',
            };

            const httpError = createHttpError(422, {
                message: 'The email address is invalid.',
                code: 'INVALID_EMAIL',
                details,
            });

            const result = service.fromHttpError(httpError);

            expect(result).toMatchObject({
                type: 'validation',
                status: 422,
                code: 'INVALID_EMAIL',
                message: 'The email address is invalid.',
                details,
            });
        });

        it('should use backend error property when message is missing', () => {
            const httpError = createHttpError(400, {
                error: 'Invalid request data.',
            });

            const result = service.fromHttpError(httpError);

            expect(result.message).toBe('Invalid request data.');
        });

        it('should prefer backend message over backend error', () => {
            const httpError = createHttpError(400, {
                message: 'Primary message',
                error: 'Secondary message',
            });

            const result = service.fromHttpError(httpError);

            expect(result.message).toBe('Primary message');
        });

        it('should use a plain backend string as message', () => {
            const httpError = createHttpError(
                409,
                ' Flight already exists. '
            );

            const result = service.fromHttpError(httpError);

            expect(result.message).toBe('Flight already exists.');
            expect(result.code).toBeNull();
            expect(result.details).toBe(' Flight already exists. ');
        });

        it('should ignore blank backend messages', () => {
            const httpError = createHttpError(404, {
                message: '   ',
            });

            const result = service.fromHttpError(httpError);

            expect(result.message).toBe(
                'The requested resource was not found.'
            );
        });

        it('should ignore non-string backend message and code values', () => {
            const httpError = createHttpError(400, {
                message: 123,
                error: false,
                code: {
                    value: 'INVALID',
                },
            });

            const result = service.fromHttpError(httpError);

            expect(result.message).toBe('The request is invalid.');
            expect(result.code).toBeNull();
        });

        it('should keep the raw HTTP error body as details when backend details are missing', () => {
            const body = {
                message: 'Request failed',
                additionalValue: 123,
            };

            const httpError = createHttpError(400, body);

            const result = service.fromHttpError(httpError);

            expect(result.details).toBe(body);
        });

        it('should use explicit backend details instead of the complete body', () => {
            const details = {
                flightId: 'flight-1',
            };

            const httpError = createHttpError(409, {
                message: 'Conflict',
                details,
                ignored: 'value',
            });

            const result = service.fromHttpError(httpError);

            expect(result.details).toBe(details);
        });

        it.each([
            [0, 'The server could not be reached.'],
            [400, 'The request is invalid.'],
            [401, 'You are not logged in.'],
            [403, 'You do not have permission for this action.'],
            [404, 'The requested resource was not found.'],
            [409, 'The request conflicts with the current state.'],
            [422, 'The submitted data is invalid.'],
            [500, 'A server error occurred.'],
            [503, 'A server error occurred.'],
            [418, 'The request could not be completed.'],
        ] as const)(
            'should use the default message for HTTP status %s',
            (status, expectedMessage) => {
                const result = service.fromHttpError(
                    createHttpError(status)
                );

                expect(result.message).toBe(expectedMessage);
            }
        );
    });

    describe('normalize', () => {
        it('should return an existing AppError unchanged', () => {
            const existingError = new AppError({
                type: 'conflict',
                status: 409,
                code: 'DUPLICATE',
                message: 'The flight already exists.',
            });

            const result = service.normalize(existingError);

            expect(result).toBe(existingError);
        });

        it('should convert an HttpErrorResponse', () => {
            const httpError = createHttpError(401);

            const result = service.normalize(httpError);

            expect(result).toBeInstanceOf(AppError);
            expect(result.type).toBe('unauthorized');
            expect(result.status).toBe(401);
        });

        it('should convert a normal Error', () => {
            const error = new Error('Calculation failed.');

            const result = service.normalize(error);

            expect(result).toMatchObject({
                type: 'unknown',
                status: null,
                code: null,
                message: 'Calculation failed.',
                cause: error,
            });
        });

        it('should use the fallback message for an Error with an empty message', () => {
            const error = new Error('');

            const result = service.normalize(
                error,
                'Fallback error message.'
            );

            expect(result.message).toBe('Fallback error message.');
            expect(result.cause).toBe(error);
        });

        it('should normalize an unknown value', () => {
            const value = {
                unexpected: true,
            };

            const result = service.normalize(
                value,
                'Unknown operation failed.'
            );

            expect(result).toMatchObject({
                type: 'unknown',
                status: null,
                code: null,
                message: 'Unknown operation failed.',
                details: value,
                cause: value,
            });
        });

        it('should normalize null', () => {
            const result = service.normalize(
                null,
                'Null error occurred.'
            );

            expect(result.message).toBe('Null error occurred.');
            expect(result.details).toBeNull();
            expect(result.cause).toBeNull();
        });
    });

    describe('getMessage', () => {
        it('should return the normalized error message', () => {
            const result = service.getMessage(
                new Error('Import failed.'),
                'Fallback message.'
            );

            expect(result).toBe('Import failed.');
        });

        it('should return the fallback message for an unknown value', () => {
            const result = service.getMessage(
                undefined,
                'Fallback message.'
            );

            expect(result).toBe('Fallback message.');
        });
    });

    describe('status helpers', () => {
        it('should recognize unauthorized errors', () => {
            expect(
                service.isUnauthorized(
                    new AppError({
                        type: 'unauthorized',
                        message: 'Unauthorized',
                    })
                )
            ).toBe(true);

            expect(
                service.isUnauthorized(createHttpError(401))
            ).toBe(true);

            expect(
                service.isUnauthorized(createHttpError(403))
            ).toBe(false);
        });

        it('should recognize forbidden errors', () => {
            expect(
                service.isForbidden(
                    new AppError({
                        type: 'forbidden',
                        message: 'Forbidden',
                    })
                )
            ).toBe(true);

            expect(
                service.isForbidden(createHttpError(403))
            ).toBe(true);

            expect(
                service.isForbidden(createHttpError(401))
            ).toBe(false);
        });

        it('should recognize not-found errors', () => {
            expect(
                service.isNotFound(
                    new AppError({
                        type: 'not-found',
                        message: 'Not found',
                    })
                )
            ).toBe(true);

            expect(
                service.isNotFound(createHttpError(404))
            ).toBe(true);

            expect(
                service.isNotFound(createHttpError(500))
            ).toBe(false);
        });
    });
});

function createHttpError(
    status: number,
    error: unknown = null
): HttpErrorResponse {
    return new HttpErrorResponse({
        status,
        error,
        statusText: 'Test Error',
        url: '/api/test',
    });
}