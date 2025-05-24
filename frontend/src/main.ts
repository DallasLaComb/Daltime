import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter, Routes } from '@angular/router';
import { LoginComponent } from './app/auth/login/login.component';
import { RegisterComponent } from './app/auth/register/register.component';

const routes: Routes = [
  { path: 'auth/login', component: LoginComponent },
  { path: 'auth/register', component: RegisterComponent },
  { path: '', redirectTo: 'auth/register', pathMatch: 'full' },
  { path: '**', redirectTo: 'auth/register' },
];

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes)],
});
