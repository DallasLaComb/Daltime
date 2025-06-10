// src/app/employee/employee.module.ts
import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { EmployeeDashboardComponent } from './components/employee-dashboard.component';
import { EmployeeRoutingModule } from './employee-routing.module';

@NgModule({
  declarations: [],
  imports: [CommonModule, EmployeeRoutingModule, EmployeeDashboardComponent],
})
export class EmployeeModule {}
