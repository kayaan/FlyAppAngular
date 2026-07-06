import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'flightSignedNumber',
  standalone: true,
})
export class FlightSignedNumberPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    digits = 1
  ): string {
    const safeValue = value ?? 0;
    const sign = safeValue > 0 ? '+' : '';

    return `${sign}${safeValue.toFixed(digits)}`;
  }
}