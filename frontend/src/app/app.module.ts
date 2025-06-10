import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { AppRoutingModule } from './core/app-routing.module';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';

@NgModule({
  imports: [BrowserModule, AppRoutingModule, HttpClientModule, AppComponent],
  bootstrap: [AppComponent],
})
export class AppModule {}
