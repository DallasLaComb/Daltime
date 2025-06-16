import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  imports: [CommonModule],
})
export class NavbarComponent {
  private auth = inject(AuthService);
  private router = inject(Router);

  role: string | null = null;

  constructor() {
    const authData = this.auth.getAuthData();
    this.role = authData?.data?.user?.role || null;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
  }
}
