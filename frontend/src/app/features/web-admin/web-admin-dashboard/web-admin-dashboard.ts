import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../../core/auth/auth';

@Component({
  selector: 'app-web-admin-dashboard',
  imports: [RouterLink],
  templateUrl: './web-admin-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WebAdminDashboard {
  protected readonly authService = inject(AuthService);
  protected readonly role = this.authService.roleSignal;
}
