import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../auth/auth.service';

interface Employee {
  id: string;
  name: string;
  email: string;
  hoursPerWeek: number;
  role: string;
  status: 'active' | 'inactive';
}

@Component({
  selector: 'manager-employees',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './manager-employees.component.html',
  styleUrl: './manager-employees.component.scss',
})
export class ManagerEmployeesComponent implements OnInit {
  private auth = inject(AuthService);
  employees: Employee[] = [];

  ngOnInit() {
    this.loadEmployees();
  }

  private loadEmployees() {
    // Mock data - replace with actual API call
    this.employees = [
      {
        id: '1',
        name: 'John Doe',
        email: 'john.doe@example.com',
        hoursPerWeek: 40,
        role: 'employee',
        status: 'active',
      },
      {
        id: '2',
        name: 'Jane Smith',
        email: 'jane.smith@example.com',
        hoursPerWeek: 35,
        role: 'employee',
        status: 'active',
      },
      {
        id: '3',
        name: 'Mike Johnson',
        email: 'mike.johnson@example.com',
        hoursPerWeek: 20,
        role: 'employee',
        status: 'inactive',
      },
    ];
  }

  getActiveEmployees(): number {
    return this.employees.filter((emp) => emp.status === 'active').length;
  }

  getTotalHours(): number {
    return this.employees
      .filter((emp) => emp.status === 'active')
      .reduce((total, emp) => total + emp.hoursPerWeek, 0);
  }

  viewEmployee(employee: Employee) {
    console.log('View employee:', employee);
    // Implement view employee functionality
  }

  editEmployee(employee: Employee) {
    console.log('Edit employee:', employee);
    // Implement edit employee functionality
  }
}
