import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIf } from '@angular/common';

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
});
