// src/app/employee/employee.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeDashboardComponent } from './components/employee-dashboard.component';
import { EmployeeRoutingModule } from './employee-routing.module';
import { EmployeeProfileComponent } from './profile/profile.component';

@NgModule({
  imports: [
    CommonModule,
    EmployeeRoutingModule,
    EmployeeDashboardComponent,
    EmployeeProfileComponent,
  ],
  exports: [EmployeeProfileComponent],
})
export class EmployeeModule {}
