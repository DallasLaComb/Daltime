// src/app/auth/login/login.component.ts
import { Component, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../auth.service';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@CommonShiftScheduler/form/input/input.component';
import { ButtonComponent } from '@CommonShiftScheduler/ui/button/button.component';
import { NgIf } from '@angular/common';
import { SpinnerComponent } from '../../shared/components/feedback/spinner/spinner.component';

@Component({
  selector: 'shift-scheduler-login',
  standalone: true,
  templateUrl: './login.component.html',
  imports: [
    FormsModule,
    InputComponent,
    ButtonComponent,
    NgIf,
    RouterModule,
    SpinnerComponent,
  ],
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
        console.log('Login response:', res);
        this.auth.saveAuthData(res);

        const role = res?.data?.user?.role;
        console.log('User role:', role);

        if (typeof role === 'string' && role.trim()) {
          const normalizedRole = role.trim().toLowerCase();
          const target =
            normalizedRole === 'employee'
              ? '/employee/profile'
              : `/${normalizedRole}/dashboard`;
          console.log('Attempting to navigate to:', target);

          this.router.navigateByUrl(target).then(
            (success) => {
              console.log('Navigation success:', success);
              this.isLoading = false;
            },
            (err) => {
              console.error('Navigation error:', err);
              this.error = `Navigation failed: ${err.message}`;
              this.isLoading = false;
            }
          );
        } else {
          console.warn('Role is undefined or invalid, navigating to root.');
          this.router.navigate(['/']).then(
            (success) => {
              console.log('Navigation to root success:', success);
              this.isLoading = false;
            },
            (err) => {
              console.error('Navigation to root error:', err);
              this.error = `Navigation failed: ${err.message}`;
              this.isLoading = false;
            }
          );
        }
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.error || 'Login failed. Please try again.';
        console.error('Login error:', err);
      },
    });
  }
}
