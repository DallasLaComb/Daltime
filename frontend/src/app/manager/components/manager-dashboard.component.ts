import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="dashboard-container">
      <h1>Manager Dashboard</h1>
      
      <div class="dashboard-stats">
        <div class="stat-card">
          <h3>Total Employees</h3>
          <p class="stat-number">{{ totalEmployees }}</p>
        </div>
        
        <div class="stat-card">
          <h3>Open Shifts</h3>
          <p class="stat-number">{{ openShifts }}</p>
        </div>
        
        <div class="stat-card">
          <h3>This Week's Hours</h3>
          <p class="stat-number">{{ weeklyHours }}</p>
        </div>
      </div>
      
      <div class="dashboard-actions">
        <button class="btn btn-primary" (click)="viewSchedule()">View Schedule</button>
        <button class="btn btn-secondary" (click)="manageEmployees()">Manage Employees</button>
        <button class="btn btn-warning" (click)="postShift()">Post New Shift</button>
      </div>
    </div>
  `,
  styles: [`
    .dashboard-container {
      padding: 2rem;
    }
    
    .dashboard-container h1 {
      margin-bottom: 2rem;
      color: #333;
    }
    
    .dashboard-stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 1.5rem;
      margin-bottom: 2rem;
    }
    
    .stat-card {
      background: white;
      padding: 1.5rem;
      border-radius: 0.5rem;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
      text-align: center;
    }
    
    .stat-card h3 {
      margin: 0 0 1rem 0;
      color: #666;
      font-size: 1rem;
    }
    
    .stat-number {
      font-size: 2.5rem;
      font-weight: bold;
      margin: 0;
      color: #007bff;
    }
    
    .dashboard-actions {
      display: flex;
      gap: 1rem;
      flex-wrap: wrap;
    }
    
    .btn {
      padding: 0.75rem 1.5rem;
      border: none;
      border-radius: 0.375rem;
      cursor: pointer;
      font-weight: 500;
      text-decoration: none;
      display: inline-block;
      transition: all 0.2s;
    }
    
    .btn-primary {
      background-color: #007bff;
      color: white;
    }
    
    .btn-primary:hover {
      background-color: #0056b3;
    }
    
    .btn-secondary {
      background-color: #6c757d;
      color: white;
    }
    
    .btn-secondary:hover {
      background-color: #545b62;
    }
    
    .btn-warning {
      background-color: #ffc107;
      color: #212529;
    }
    
    .btn-warning:hover {
      background-color: #e0a800;
    }
  `]
})
export class ManagerDashboardComponent {
  totalEmployees = 15;
  openShifts = 3;
  weeklyHours = 120;

  viewSchedule() {
    console.log('View schedule clicked');
    // Navigate to schedule view
  }

  manageEmployees() {
    console.log('Manage employees clicked');
    // Navigate to employees view
  }

  postShift() {
    console.log('Post shift clicked');
    // Navigate to post shift form
  }
}
