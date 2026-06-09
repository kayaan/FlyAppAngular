import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { FlightList } from './features/flights/pages/flight-list/flight-list';
import { FlightDetails } from './features/flights/pages/flight-details/flight-details';

export const routes: Routes = [
  {
    path: '',
    component: AppShell,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'flights',
      },
      {
        path: 'flights',
        component: FlightList,
      },
      {
        path: 'flights/:id',
        component: FlightDetails,
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'flights',
  },
];