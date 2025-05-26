import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { InputComponent } from '@CommonShiftScheduler/form/input/input.component';
import { SelectComponent } from '@CommonShiftScheduler/form/select/select.component';
import { ButtonComponent } from '@CommonShiftScheduler/ui/button/button.component';
import { NgIf } from '@angular/common';
import { RouterModule } from '@angular/router';
@Component({
  selector: 'shift-scheduler-register',
  standalone: true,
  imports: [
    FormsModule,
    InputComponent,
    SelectComponent,
    ButtonComponent,
    NgIf,
    RouterModule,
  ],
  templateUrl: './register.component.html',
})
export class RegisterComponent {
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
    console.log('Form submitted:', {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      company: this.company,
      role: this.role,
      managers: this.managers,
      password: this.password,
      confirmPassword: this.confirmPassword,
    });
  }
}
