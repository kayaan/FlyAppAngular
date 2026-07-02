import { Routes } from '@angular/router';
import { AppShell } from './core/layout/app-shell/app-shell';
import { PublicFlightList } from './features/flights/pages/public-flight-list/public-flight-list';
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
      {
        path: 'public/flights/:id',
        component: FlightDetails,
        data: { source: 'public' },
      },
      {
        path: 'explore',
        component: PublicFlightList,
      }
    ],
  },
  {
    path: '**',
    redirectTo: 'flights',
  },
];