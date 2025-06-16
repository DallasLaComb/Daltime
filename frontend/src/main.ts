import { bootstrapApplication } from '@angular/platform-browser';
import { AppComponent } from './app/app.component';
import { provideRouter } from '@angular/router';
import { routes } from './app/core/app-routing.module';
import { provideHttpClient } from '@angular/common/http';
import { NavbarComponent } from './app/shared/navbar/navbar.component';

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes), provideHttpClient(), NavbarComponent],
}).catch((err) => console.error(err));
