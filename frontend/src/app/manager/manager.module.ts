import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ManagerComponent } from './components/manager.component';
import { ManagerRoutingModule } from './manager-routing.module';

@NgModule({
  declarations: [ManagerComponent],
  imports: [CommonModule, ManagerRoutingModule],
})
export class ManagerModule {}
