import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AdminDashboardComponent } from './components/admin-dashboard.component';
import { AdminRoutingModule } from './admin-routing.module';

@NgModule({
  declarations: [],
  imports: [
    CommonModule,
    RouterModule,
    AdminRoutingModule,
    AdminDashboardComponent,
  ],
})
export class AdminModule {}
