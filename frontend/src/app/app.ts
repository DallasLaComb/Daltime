import { Component, OnInit, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from './core/auth/auth';
import { Navbar } from './shared/navbar/navbar';
import { Footer } from './shared/footer/footer';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Navbar, Footer],
  templateUrl: './app.html',
  host: { class: 'flex flex-col min-h-screen px-2 pt-2 md:px-3 md:pt-3' },
})
export class App implements OnInit {
  protected readonly authService = inject(AuthService);

  ngOnInit(): void {
    this.authService.initialize();
  }
}
