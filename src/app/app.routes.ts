import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';

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
        loadComponent: () =>
          import('./features/flights/pages/flight-list/flight-list').then(
            (m) => m.FlightList
          ),
      },
      {
        path: 'flights/:id',
        loadComponent: () =>
          import('./features/flights/pages/flight-details/flight-details').then(
            (m) => m.FlightDetails
          ),
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'flights',
  },
];