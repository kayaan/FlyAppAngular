import { Routes } from '@angular/router';
import { AppShellComponent } from './core/layout/app-shell/app-shell.component';
import { FlightListComponent } from './features/flights/pages/flight-list/flight-list.component';
import { FlightDetailsComponent } from './features/flights/pages/flight-details/flight-details.component';
import { FlightImportComponent } from './features/flights/pages/flight-import/flight-import.component';

export const routes: Routes = [
  {
    path: '',
    component: AppShellComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'flights',
      },
      {
        path: 'flights',
        component: FlightListComponent,
      },
      {
        path: 'flights/:id',
        component: FlightDetailsComponent,
      },
      {
        path: 'import',
        component: FlightImportComponent,
      },
    ],
  },
  {
    path: '**',
    redirectTo: 'flights',
  },
];