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
        // Determine role and redirect
        const role = res.user?.role || res.user?.[0]?.role;
        console.log('User role:', role);
        // Defensive: check for string and trim/lowercase
        if (typeof role === 'string') {
          const normalizedRole = role.trim().toLowerCase();
          let target = '/';
          if (normalizedRole === 'employee') {
            target = '/employee/dashboard';
          } else if (normalizedRole === 'manager') {
            target = '/manager/dashboard';
          } else if (normalizedRole === 'admin') {
            target = '/admin/dashboard';
          }
          console.log('Attempting to navigate to:', target);
          this.router.navigate([target]).then(
            (success) => console.log('Navigation success:', success),
            (err) => console.error('Navigation error:', err)
          );
        } else {
          console.log('Role not a string, navigating to root.');
          this.router.navigate(['/']);
        }
        this.isLoading = false;
      },
      error: (err) => {
        this.isLoading = false;
        this.error = err?.error?.error || 'Login failed. Please try again.';
        console.error('Login error:', err);
      },
    });
  }
}
