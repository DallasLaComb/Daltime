// src/app/auth/login/login.component.ts
import { Component } from '@angular/core';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { CommonModule } from '@angular/common';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, HttpClientModule],
  templateUrl: './login.component.html',
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit(): void {
    this.authService.login(this.email, this.password).subscribe({
      next: (res) => {
        console.log('SAVING AUTH DATA', res);
        this.authService.saveAuthData(res);
        this.router.navigate(['/employee/home']);
      },
      error: (err) => {
        this.error = err.error?.error || 'Login failed. Please try again.';
      },
    });
  }
}
