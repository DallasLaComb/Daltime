import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from '../app.component';
import { AppRoutingModule } from './app-routing.module';
import { HttpClientModule } from '@angular/common/http';
@NgModule({
  declarations: [],
  imports: [BrowserModule, AppRoutingModule, AppComponent, HttpClientModule],
})
export class AppModule {}
