import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'flightNumber',
  standalone: true,
})
export class FlightNumberPipe implements PipeTransform {
  transform(
    value: number | null | undefined,
    digits = 0
  ): string {
    return (value ?? 0).toFixed(digits);
  }
}