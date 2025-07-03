import { Component, inject, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@CommonShiftScheduler/form/input/input.component';
import { SelectComponent } from '@CommonShiftScheduler/form/select/select.component';
import { ButtonComponent } from '@CommonShiftScheduler/ui/button/button.component';
import { NgIf } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';
import { SpinnerComponent } from '../../shared/components/feedback/spinner/spinner.component';
import { environment } from '../../../environments/environment';
import { AuthService } from '../auth.service';

interface Company {
  companyid: string;
  companyname: string;
  hqaddress: string;
  phonenumber: string;
}

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
export class RegisterComponent implements OnInit {
  http = inject(HttpClient);
  router = inject(Router);
  private auth = inject(AuthService);

  firstName = '';
  lastName = '';
  email = '';
  phoneNumber = '';
  companyId = '';
  role = '';
  password = '';
  confirmPassword = '';
  passwordTouched = false;
  showPassword = false;
  isLoading = false;

  companies: Company[] = [
    {
      companyid: '0433bb9b-fd98-459a-8b2e-b48e854ace17',
      companyname: 'Meriden YMCA',
      hqaddress: '110 W Main St, Meriden, CT 06451',
      phonenumber: '2032356386',
    },
    {
      companyid: '29d2410a-db42-433f-8e00-649f0efb97bd',
      companyname: 'Wallingford YMCA',
      hqaddress: '81 S Elm St, Wallingford, CT 06492',
      phonenumber: '2032694497',
    },
    {
      companyid: 'dde77bbb-b99c-4d7b-af4c-d6e19606f1d3',
      companyname: 'Southington YMCA',
      hqaddress: '29 High St, Southington, CT 06489',
      phonenumber: '8606285597',
    },
  ];

  // Computed property for select component options
  get companyOptions(): string[] {
    return this.companies.map((company) => company.companyname);
  }

  registrationError: string | null = null;
  registrationSuccess: boolean = false;

  ngOnInit() {
    // Component initialization if needed
  }

  // Get selected company by name
  get selectedCompany(): Company | undefined {
    return this.companies.find(
      (company) => company.companyname === this.companyId
    );
  }

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
  get invalidPhoneNumber(): boolean {
    // US phone number validation (10 digits)
    const cleaned = this.phoneNumber.replace(/\D/g, '');
    return this.phoneNumber.length > 0 && cleaned.length !== 10;
  }

  get isFormValid(): boolean {
    return (
      this.firstName.length > 0 &&
      !this.firstNameTooLong &&
      this.lastName.length > 0 &&
      !this.lastNameTooLong &&
      this.email.length > 0 &&
      !this.invalidEmail &&
      this.phoneNumber.length > 0 &&
      !this.invalidPhoneNumber &&
      this.companyId.length > 0 &&
      this.role.length > 0 &&
      this.password === this.confirmPassword &&
      this.isPasswordStrong(this.password)
    );
  }

  get apiBaseUrl(): string {
    return environment.apiBaseUrl;
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
    if (this.invalidPhoneNumber) {
      this.registrationError = 'Please enter a valid 10-digit phone number.';
      this.isLoading = false;
      return;
    }
    if (this.password !== this.confirmPassword) {
      this.registrationError = 'Passwords do not match.';
      this.isLoading = false;
      return;
    }
    if (!this.isPasswordStrong(this.password)) {
      this.registrationError = 'Password does not meet requirements.';
      this.isLoading = false;
      return;
    }

    // Get the selected company's ID
    const selectedCompany = this.companies.find(
      (company) => company.companyname === this.companyId
    );
    if (!selectedCompany) {
      this.registrationError = 'Please select a valid company.';
      this.isLoading = false;
      return;
    }

    const payload = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      phoneNumber: this.phoneNumber,
      companyId: selectedCompany.companyid,
      role: this.role,
      password: this.password,
    };

    this.auth.register(payload).subscribe({
      next: (res) => {
        this.isLoading = false;
        this.registrationSuccess = true;
        setTimeout(() => {
          this.router.navigate(['/auth/login']);
        }, 1200);
      },
      error: (err) => {
        this.isLoading = false;
        this.registrationError =
          err?.error?.error ||
          'Registration failed. Check the console for details.';
        console.error('Registration failed:', err);
      },
    });
  }
}
