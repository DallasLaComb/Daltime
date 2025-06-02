// src/app/auth/login/login.component.ts
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@CommonShiftScheduler/form/input/input.component';
import { ButtonComponent } from '@CommonShiftScheduler/ui/button/button.component';
import { NgIf } from '@angular/common';

@Component({
  selector: 'shift-scheduler-login',
  standalone: true,
  templateUrl: './login.component.html',
  imports: [FormsModule, InputComponent, ButtonComponent, NgIf, RouterModule],
})
export class LoginComponent {
  email = '';
  password = '';
  error: string | null = null;
  isLoading = false;

  private auth = inject(AuthService);
  private router = inject(Router);

  onSubmit() {
    this.error = null;
    this.isLoading = true;
    this.auth.login(this.email, this.password).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.auth.saveAuthData(res);
        this.router.navigate(['/']);
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.error || 'Login failed. Please try again.';
      },
    });
  }
}
