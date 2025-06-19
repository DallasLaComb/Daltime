import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../auth/auth.service';
import { Subject } from 'rxjs';

@Component({
  selector: 'app-navbar',
  templateUrl: './navbar.component.html',
  styleUrls: ['./navbar.component.scss'],
  standalone: true,
  imports: [CommonModule],
})
export class NavbarComponent implements OnInit, OnDestroy {
  private auth = inject(AuthService);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  role: string | null = null;
  userEmail: string | null = null;
  userName: string | null = null;
  isDropdownOpen = false;

  ngOnInit() {
    this.updateUserInfo();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private updateUserInfo() {
    const authData = this.auth.getAuthData();
    this.role = authData?.data?.user?.role || null;
    this.userEmail = authData?.data?.user?.['email'] || null;
    this.userName = authData?.data?.user?.['user_metadata']?.['firstName']
      ? `${authData.data.user['user_metadata']['firstName']} ${
          authData.data.user['user_metadata']['lastName'] || ''
        }`.trim()
      : this.userEmail;
  }

  navigateTo(route: string): void {
    this.router.navigate([route]);
    this.isDropdownOpen = false;
  }

  toggleDropdown(): void {
    this.isDropdownOpen = !this.isDropdownOpen;
  }

  logout(): void {
    this.auth.logout();
    this.router.navigate(['/auth/login']);
    this.isDropdownOpen = false;
  }
}
