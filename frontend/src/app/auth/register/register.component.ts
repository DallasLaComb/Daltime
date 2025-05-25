import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AuthService } from '../auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, HttpClientModule], // ✅ FIX HERE
  templateUrl: './register.component.html',
})
export class RegisterComponent {
  email = '';
  password = '';
  confirmPassword = '';

  constructor(private auth: AuthService) {}

  register() {
    if (this.password !== this.confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    this.auth.register(this.email, this.password).subscribe({
      next: () => alert('Registration successful!'),
      error: (err) => alert('Registration failed: ' + err.error?.error),
    });
  }
}
