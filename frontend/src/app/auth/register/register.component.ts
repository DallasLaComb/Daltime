import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@CommonShiftScheduler/form/input/input.component';
import { SelectComponent } from '@CommonShiftScheduler/form/select/select.component';
import { ButtonComponent } from '@CommonShiftScheduler/ui/button/button.component';
import { NgIf } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SpinnerComponent } from '../../shared/components/feedback/spinner/spinner.component';

@Component({
  selector: 'shift-scheduler-register',
  standalone: true,
  templateUrl: './register.component.html',
  imports: [
    FormsModule,
    InputComponent,
    SelectComponent,
    ButtonComponent,
    NgIf,
    RouterModule,
    MatIconModule,
    SpinnerComponent,
  ],
})
export class RegisterComponent {
  http = inject(HttpClient);
  router = inject(Router);

  firstName = '';
  lastName = '';
  email = '';
  company = '';
  role = '';
  managers = '';
  password = '';
  confirmPassword = '';
  passwordTouched = false;
  showPassword = false;
  isLoading = false;

  companies = ['Meriden YMCA', 'Southington YMCA', 'Wallingford YMCA'];

  registrationError: string | null = null;
  registrationSuccess: boolean = false;

  // Password strength validation
  isPasswordStrong(password: string): boolean {
    // At least 8, max 20, 1 uppercase, 1 lowercase, 1 number, 1 special char
    const strongRegex =
      /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]).{8,20}$/;
    return strongRegex.test(password);
  }

  // Password requirement checks for template
  get passwordTooShort(): boolean {
    return this.password.length > 0 && this.password.length < 8;
  }
  get passwordTooLong(): boolean {
    return this.password.length > 20;
  }
  get passwordMissingUpper(): boolean {
    return this.password.length > 0 && !/[A-Z]/.test(this.password);
  }
  get passwordMissingLower(): boolean {
    return this.password.length > 0 && !/[a-z]/.test(this.password);
  }
  get passwordMissingNumber(): boolean {
    return this.password.length > 0 && !/[0-9]/.test(this.password);
  }
  get passwordMissingSpecial(): boolean {
    return (
      this.password.length > 0 &&
      !/[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(this.password)
    );
  }

  // Validation helpers
  get firstNameTooLong(): boolean {
    return this.firstName.length > 30;
  }
  get lastNameTooLong(): boolean {
    return this.lastName.length > 30;
  }
  get invalidEmail(): boolean {
    // Simple email regex
    return this.email.length > 0 && !/^\S+@\S+\.\S+$/.test(this.email);
  }

  get isFormValid(): boolean {
    return (
      this.firstName.length > 0 &&
      !this.firstNameTooLong &&
      this.lastName.length > 0 &&
      !this.lastNameTooLong &&
      this.email.length > 0 &&
      !this.invalidEmail &&
      this.company.length > 0 &&
      this.role.length > 0 &&
      (this.role !== 'employee' || this.managers.length > 0) &&
      this.password === this.confirmPassword &&
      this.isPasswordStrong(this.password)
    );
  }

  register() {
    this.passwordTouched = true;
    this.registrationError = null;
    this.registrationSuccess = false;
    this.isLoading = true;
    if (this.firstNameTooLong) {
      this.registrationError = 'First name must be 30 characters or less.';
      this.isLoading = false;
      return;
    }
    if (this.lastNameTooLong) {
      this.registrationError = 'Last name must be 30 characters or less.';
      this.isLoading = false;
      return;
    }
    if (this.invalidEmail) {
      this.registrationError = 'Please enter a valid email address.';
      this.isLoading = false;
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.registrationError = 'Passwords do not match.';
      this.isLoading = false;
      return;
    }
    if (!this.isPasswordStrong(this.password)) {
      // Do not alert, show message in template
      this.registrationError = 'Password does not meet requirements.';
      this.isLoading = false;
      return;
    }

    const payload = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      company: this.company,
      role: this.role,
      managers:
        this.role === 'employee'
          ? this.managers.split(',').map((m) => m.trim())
          : [],
      password: this.password,
    };

    this.http.post('http://localhost:3000/auth/register', payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        console.log('Registration successful:', res);
        this.registrationSuccess = true;
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 1200);
      },
      error: (err) => {
        this.isLoading = false;
        console.error('Registration failed:', err);
        this.registrationError =
          'Registration failed. Check the console for details.';
      },
    });
  }
}
