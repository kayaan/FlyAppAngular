import { describe, expect, it } from 'vitest';

import { AppError } from './app-error';

describe('AppError', () => {
  it('should create an AppError with all values', () => {
    const cause = new Error('Original error');
    const details = {
      flightId: 'flight-1',
    };

    const error = new AppError({
      type: 'conflict',
      status: 409,
      code: 'FLIGHT_EXISTS',
      message: 'The flight already exists.',
      details,
      cause,
    });

    expect(error).toBeInstanceOf(Error);
    expect(error).toBeInstanceOf(AppError);

    expect(error.name).toBe('AppError');
    expect(error.message).toBe('The flight already exists.');

    expect(error.type).toBe('conflict');
    expect(error.status).toBe(409);
    expect(error.code).toBe('FLIGHT_EXISTS');
    expect(error.details).toBe(details);
    expect(error.cause).toBe(cause);
  });

  it('should use null for omitted status and code', () => {
    const error = new AppError({
      type: 'unknown',
      message: 'Something failed.',
    });

    expect(error.status).toBeNull();
    expect(error.code).toBeNull();
  });

  it('should leave omitted details and cause undefined', () => {
    const error = new AppError({
      type: 'server',
      message: 'Server error.',
    });

    expect(error.details).toBeUndefined();
    expect(error.cause).toBeUndefined();
  });

  it.each([
    'network',
    'unauthorized',
    'forbidden',
    'not-found',
    'conflict',
    'validation',
    'server',
    'unknown',
  ] as const)(
    'should preserve the error type %s',
    (type) => {
      const error = new AppError({
        type,
        message: 'Test error',
      });

      expect(error.type).toBe(type);
    }
  );

  it('should preserve the normal Error stack behavior', () => {
    const error = new AppError({
      type: 'unknown',
      message: 'Test error',
    });

    expect(error.stack).toContain('AppError');
    expect(error.stack).toContain('Test error');
  });
});