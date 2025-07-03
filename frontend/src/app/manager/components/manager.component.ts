import { Component } from '@angular/core';

@Component({
  selector: 'app-manager',
  template: `
    <div class="manager-container">
      <nav class="manager-nav">
        <h2>Manager Dashboard</h2>
        <ul>
          <li><a routerLink="dashboard" routerLinkActive="active">Dashboard</a></li>
          <li><a routerLink="employees" routerLinkActive="active">Employees</a></li>
          <li><a routerLink="shifts-needed" routerLinkActive="active">Shifts Needed</a></li>
        </ul>
      </nav>
      <main class="manager-content">
        <router-outlet></router-outlet>
      </main>
    </div>
  `,
  styles: [`
    .manager-container {
      display: flex;
      min-height: 100vh;
    }
    
    .manager-nav {
      width: 250px;
      background-color: #f8f9fa;
      padding: 1rem;
      border-right: 1px solid #dee2e6;
    }
    
    .manager-nav h2 {
      margin-bottom: 1.5rem;
      color: #495057;
    }
    
    .manager-nav ul {
      list-style: none;
      padding: 0;
      margin: 0;
    }
    
    .manager-nav li {
      margin-bottom: 0.5rem;
    }
    
    .manager-nav a {
      display: block;
      padding: 0.75rem 1rem;
      text-decoration: none;
      color: #6c757d;
      border-radius: 0.375rem;
      transition: all 0.2s;
    }
    
    .manager-nav a:hover {
      background-color: #e9ecef;
      color: #495057;
    }
    
    .manager-nav a.active {
      background-color: #007bff;
      color: white;
    }
    
    .manager-content {
      flex: 1;
      padding: 2rem;
    }
  `]
})
export class ManagerComponent {}
