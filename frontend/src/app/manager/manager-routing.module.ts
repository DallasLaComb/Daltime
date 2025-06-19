import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';

const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./components/manager-dashboard.component').then(
        (m) => m.ManagerDashboardComponent
      ),
  },
  {
    path: 'employees',
    loadComponent: () =>
      import('./components/manager-employees/manager-employees.component').then(
        (m) => m.ManagerEmployeesComponent
      ),
  },
  {
    path: 'shifts-needed',
    loadComponent: () =>
      import(
        './components/manager-shifts-needed/manager-shifts-needed.component'
      ).then((m) => m.ManagerShiftsNeededComponent),
  },
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule],
})
export class ManagerRoutingModule {}
