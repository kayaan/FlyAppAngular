import { describe, expect, it } from 'vitest';

import { FlightDatePipe } from './flight-date.pipe';
import { FlightDurationPipe } from './flight-duration.pipe';
import { FlightNumberPipe } from './flight-number.pipe';
import { FlightSignedNumberPipe } from './flight-signed-number.pipe';

describe('FlightDurationPipe', () => {
  const pipe = new FlightDurationPipe();

  it('should return a placeholder for null and undefined', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
  });

  it('should format seconds as HH:mm:ss', () => {
    expect(pipe.transform(0)).toBe('00:00:00');
    expect(pipe.transform(65)).toBe('00:01:05');
    expect(pipe.transform(3_661)).toBe('01:01:01');
    expect(pipe.transform(36_000)).toBe('10:00:00');
  });

  it('should omit seconds when requested', () => {
    expect(pipe.transform(65, false)).toBe('00:01');
    expect(pipe.transform(3_661, false)).toBe('01:01');
  });

  it('should floor decimal seconds', () => {
    expect(pipe.transform(65.99)).toBe('00:01:05');
  });

  it('should clamp negative values to zero', () => {
    expect(pipe.transform(-1)).toBe('00:00:00');
    expect(pipe.transform(-500, false)).toBe('00:00');
  });
});

describe('FlightNumberPipe', () => {
  const pipe = new FlightNumberPipe();

  it('should format numbers with zero decimal places by default', () => {
    expect(pipe.transform(12.4)).toBe('12');
    expect(pipe.transform(12.6)).toBe('13');
  });

  it('should format numbers with the requested decimal places', () => {
    expect(pipe.transform(12.345, 1)).toBe('12.3');
    expect(pipe.transform(12.345, 2)).toBe('12.35');
  });

  it('should format null and undefined as zero', () => {
    expect(pipe.transform(null)).toBe('0');
    expect(pipe.transform(undefined, 2)).toBe('0.00');
  });

  it('should preserve negative values', () => {
    expect(pipe.transform(-1.25, 1)).toBe('-1.3');
  });
});

describe('FlightSignedNumberPipe', () => {
  const pipe = new FlightSignedNumberPipe();

  it('should add a plus sign to positive values', () => {
    expect(pipe.transform(1.25)).toBe('+1.3');
    expect(pipe.transform(2.345, 2)).toBe('+2.35');
  });

  it('should not add a plus sign to zero', () => {
    expect(pipe.transform(0)).toBe('0.0');
  });

  it('should preserve the minus sign for negative values', () => {
    expect(pipe.transform(-1.25)).toBe('-1.3');
  });

  it('should format null and undefined as zero', () => {
    expect(pipe.transform(null)).toBe('0.0');
    expect(pipe.transform(undefined, 2)).toBe('0.00');
  });

  it('should use one decimal place by default', () => {
    expect(pipe.transform(1)).toBe('+1.0');
  });
});

describe('FlightDatePipe', () => {
  const pipe = new FlightDatePipe();

  it('should return a placeholder for null, undefined and empty strings', () => {
    expect(pipe.transform(null)).toBe('—');
    expect(pipe.transform(undefined)).toBe('—');
    expect(pipe.transform('')).toBe('—');
  });

  it('should format ISO dates using German date format', () => {
    expect(pipe.transform('2026-07-12')).toBe('12.07.2026');
  });

  it('should format ISO timestamps', () => {
    expect(
      pipe.transform('2026-07-12T12:00:00Z')
    ).toBe('12.07.2026');
  });

  it('should return the original value for an invalid date', () => {
    expect(pipe.transform('not-a-date')).toBe('not-a-date');
  });
});