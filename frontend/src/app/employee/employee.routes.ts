// src/app/employee/employee.routes.ts
import { Routes } from '@angular/router';
import { EmployeeDashboardComponent } from './components/employee-dashboard.component';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () =>
      import('./components/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'dashboard',
    component: EmployeeDashboardComponent,
  },
  {
    path: 'profile',
    loadComponent: () =>
      import('./profile/profile.component').then((m) => m.EmployeeProfileComponent),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
