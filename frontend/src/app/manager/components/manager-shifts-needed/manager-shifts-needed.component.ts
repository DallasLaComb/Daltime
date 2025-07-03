import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';
import { InputComponent } from '../../../shared/components/form/input/input.component';
import { SelectComponent } from '../../../shared/components/form/select/select.component';

interface ShiftNeeded {
  id: number;
  title: string;
  department: string;
  date: string;
  startTime: string;
  endTime: string;
  hourlyRate: number;
  description: string;
  requirements: string[];
  status: 'open' | 'filled' | 'cancelled';
  applicants: number;
  position: string;
  priority: 'low' | 'medium' | 'high';
}

@Component({
  selector: 'app-manager-shifts-needed',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent, InputComponent, SelectComponent],
  templateUrl: './manager-shifts-needed.component.html',
  styleUrls: ['./manager-shifts-needed.component.scss']
})
export class ManagerShiftsNeededComponent implements OnInit {
  shiftsNeeded: ShiftNeeded[] = [
    {
      id: 1,
      title: 'Evening Cashier',
      position: 'Evening Cashier',
      department: 'Front End',
      date: '2025-06-20',
      startTime: '16:00',
      endTime: '24:00',
      hourlyRate: 15.50,
      description: 'Need cashier for evening shift to cover high traffic hours',
      requirements: ['Cash handling experience', 'Customer service skills'],
      status: 'open',
      applicants: 3,
      priority: 'high'
    },
    {
      id: 2,
      title: 'Stock Clerk',
      position: 'Stock Clerk',
      department: 'Inventory',
      date: '2025-06-21',
      startTime: '06:00',
      endTime: '14:00',
      hourlyRate: 14.00,
      description: 'Morning stock clerk needed for inventory and restocking',
      requirements: ['Physical ability to lift 50lbs', 'Attention to detail'],
      status: 'open',
      applicants: 1,
      priority: 'medium'
    },
    {
      id: 3,
      title: 'Sales Associate',
      position: 'Sales Associate',
      department: 'Sales',
      date: '2025-06-22',
      startTime: '10:00',
      endTime: '18:00',
      hourlyRate: 16.00,
      description: 'Weekend sales associate for busy Saturday shift',
      requirements: ['Sales experience preferred', 'Team player'],
      status: 'filled',
      applicants: 5,
      priority: 'low'
    }
  ];

  filteredShifts: ShiftNeeded[] = [];
  selectedDepartment = 'all';
  selectedStatus = 'all';
  priorityOptions = ['low', 'medium', 'high'];

  showAddForm = false;
  
  newShift: Partial<ShiftNeeded> = {
    date: '',
    position: '',
    startTime: '',
    endTime: '',
    priority: 'medium',
    description: '',
    status: 'open',
    applicants: 0
  };

  ngOnInit() {
    this.filteredShifts = [...this.shiftsNeeded];
  }

  onDepartmentFilter(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedDepartment = target.value;
    this.filterShifts();
  }

  onStatusFilter(event: Event) {
    const target = event.target as HTMLSelectElement;
    this.selectedStatus = target.value;
    this.filterShifts();
  }

  private filterShifts() {
    this.filteredShifts = this.shiftsNeeded.filter(shift => {
      const matchesDepartment = this.selectedDepartment === 'all' || shift.department === this.selectedDepartment;
      const matchesStatus = this.selectedStatus === 'all' || shift.status === this.selectedStatus;
      
      return matchesDepartment && matchesStatus;
    });
  }

  editShift(shift: ShiftNeeded) {
    console.log('Edit shift:', shift);
    // Implement edit functionality
  }

  deleteShift(shift: ShiftNeeded) {
    console.log('Delete shift:', shift);
    if (confirm(`Are you sure you want to delete the shift "${shift.title}"?`)) {
      this.shiftsNeeded = this.shiftsNeeded.filter(s => s.id !== shift.id);
      this.filterShifts();
    }
  }

  viewApplicants(shift: ShiftNeeded) {
    console.log('View applicants for shift:', shift);
    // Implement view applicants functionality
  }

  createShift() {
    console.log('Create new shift');
    // Implement create shift functionality
  }

  addShift() {
    if (this.newShift.date && this.newShift.position && this.newShift.startTime && this.newShift.endTime) {
      const shift: ShiftNeeded = {
        id: Math.max(...this.shiftsNeeded.map(s => s.id)) + 1,
        title: this.newShift.position,
        position: this.newShift.position,
        department: 'General', // Default department
        date: this.newShift.date,
        startTime: this.newShift.startTime,
        endTime: this.newShift.endTime,
        hourlyRate: 15.00, // Default rate
        description: this.newShift.description || '',
        requirements: [], // Default empty requirements
        status: 'open',
        applicants: 0,
        priority: this.newShift.priority || 'medium'
      };
      
      this.shiftsNeeded.push(shift);
      this.filterShifts();
      this.cancelAdd();
    }
  }

  cancelAdd() {
    this.showAddForm = false;
    this.newShift = {
      date: '',
      position: '',
      startTime: '',
      endTime: '',
      priority: 'medium',
      description: '',
      status: 'open',
      applicants: 0
    };
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'open': return '#ffc107';
      case 'filled': return '#28a745';
      case 'cancelled': return '#dc3545';
      default: return '#6c757d';
    }
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'short', 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  }

  formatTime(timeString: string): string {
    const [hours, minutes] = timeString.split(':');
    const hour = parseInt(hours, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    return `${displayHour}:${minutes} ${ampm}`;
  }
}
