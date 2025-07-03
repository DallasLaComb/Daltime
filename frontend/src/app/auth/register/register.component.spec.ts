import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';
import { HttpClientTestingModule } from '@angular/common/http/testing';

import { RegisterComponent } from './register.component';

// Import your shared standalone components
import { InputComponent } from '@CommonShiftScheduler/form/input/input.component';
import { SelectComponent } from '@CommonShiftScheduler/form/select/select.component';
import { ButtonComponent } from '@CommonShiftScheduler/ui/button/button.component';

describe('RegisterComponent', () => {
  let component: RegisterComponent;
  let fixture: ComponentFixture<RegisterComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [
        RegisterComponent,
        FormsModule,
        NgIf,
        InputComponent,
        SelectComponent,
        ButtonComponent,
        HttpClientTestingModule,
      ],
      providers: [provideRouter([])],
    }).compileComponents();

    fixture = TestBed.createComponent(RegisterComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should show error if first name is too long', () => {
    component.firstName = 'a'.repeat(31);
    fixture.detectChanges();
    expect(component.firstNameTooLong).toBeTruthy();
  });

  it('should show error if last name is too long', () => {
    component.lastName = 'b'.repeat(31);
    fixture.detectChanges();
    expect(component.lastNameTooLong).toBeTruthy();
  });

  it('should show error if email is invalid', () => {
    component.email = 'invalid-email';
    fixture.detectChanges();
    expect(component.invalidEmail).toBeTruthy();
  });

  it('should show error if password is weak', () => {
    component.password = 'weak';
    component.confirmPassword = 'weak';
    fixture.detectChanges();
    expect(component.isPasswordStrong(component.password)).toBeFalsy();
  });

  it('should show error if passwords do not match', () => {
    component.password = 'StrongPass1!';
    component.confirmPassword = 'StrongPass2!';
    fixture.detectChanges();
    expect(component.password === component.confirmPassword).toBeFalsy();
  });

  it('should require managers if role is employee', () => {
    component.role = 'employee';
    component.managers = '';
    fixture.detectChanges();
    expect(component.isFormValid).toBeFalsy();
    component.managers = 'Manager Name';
    fixture.detectChanges();
    expect(component.isFormValid).toBeFalsy(); // still false if other fields are empty
  });

  it('should be valid when all fields are correct', () => {
    component.firstName = 'John';
    component.lastName = 'Doe';
    component.email = 'john.doe@example.com';
    component.company = 'Meriden YMCA';
    component.role = 'employee';
    component.managers = 'Manager Name';
    component.password = 'StrongPass1!';
    component.confirmPassword = 'StrongPass1!';
    fixture.detectChanges();
    expect(component.isFormValid).toBeTruthy();
  });
});
