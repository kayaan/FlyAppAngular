import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-flight-list',
  imports: [RouterLink],
  templateUrl: './flight-list.html',
  styleUrl: './flight-list.scss',
})
export class FlightList {}