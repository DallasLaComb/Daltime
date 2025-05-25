// src/app/employee/components/home/home.component.ts
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { jwtDecode } from 'jwt-decode';
import { AuthService } from '../../../auth/auth.service';

interface SupabaseJwtPayload {
  sub: string;
  email?: string;
  role?: string;
  exp: number;
  [key: string]: any;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  token: string | null = null;
  decoded: SupabaseJwtPayload | null = null;

  constructor(private authService: AuthService) {}

  ngOnInit(): void {
    this.token = this.authService.getToken();

    if (this.token) {
      try {
        this.decoded = jwtDecode<SupabaseJwtPayload>(this.token);
        console.log('Decoded token:', this.decoded);
      } catch (error) {
        console.error('Failed to decode token:', error);
      }
    }
  }

  logout(): void {
    this.authService.logout();
    window.location.reload(); // or navigate to login
  }
}
