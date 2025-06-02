import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ManagerComponent } from './components/manager.component';
import { ManagerRoutingModule } from './manager-routing.module';
import { ManagerDashboardComponent } from './components/manager-dashboard.component';

@NgModule({
  declarations: [ManagerComponent],
  imports: [CommonModule, ManagerRoutingModule, ManagerDashboardComponent],
})
export class ManagerModule {}
