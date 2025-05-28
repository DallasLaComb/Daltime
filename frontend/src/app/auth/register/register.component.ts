import { Component, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@CommonShiftScheduler/form/input/input.component';
import { SelectComponent } from '@CommonShiftScheduler/form/select/select.component';
import { ButtonComponent } from '@CommonShiftScheduler/ui/button/button.component';
import { NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';

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
  ],
})
export class RegisterComponent {
  http = inject(HttpClient);

  firstName = '';
  lastName = '';
  email = '';
  company = '';
  role = '';
  managers = '';
  password = '';
  confirmPassword = '';

  companies = ['Meriden YMCA', 'Southington YMCA', 'Wallingford YMCA'];

  register() {
    if (this.password !== this.confirmPassword) {
      alert('Passwords do not match.');
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
        console.log('Registration successful:', res);
        alert('User registered successfully!');
      },
      error: (err) => {
        console.error('Registration failed:', err);
        alert('Registration failed. Check the console for details.');
      },
    });
  }
}
