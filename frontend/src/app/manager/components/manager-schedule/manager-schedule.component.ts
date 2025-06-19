import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ManagerService, Shift, ScheduleSummary } from '../../services/manager.service';
import { ButtonComponent } from '../../../shared/components/ui/button/button.component';

@Component({
  selector: 'app-manager-schedule',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonComponent],
  templateUrl: './manager-schedule.component.html',
  styleUrls: ['./manager-schedule.component.scss']
})
export class ManagerScheduleComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  shifts: Shift[] = [];
  summary: ScheduleSummary | null = null;
  loading = false;
  error: string | null = null;
  
  // Filter options
  fillStatusFilter = 'all';
  startDate = '';
  endDate = '';
  
  constructor(private managerService: ManagerService) {}

  ngOnInit() {
    this.loadSchedule();
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  loadSchedule() {
    this.loading = true;
    this.error = null;

    const params = {
      fillStatus: this.fillStatusFilter !== 'all' ? this.fillStatusFilter : undefined,
      startDate: this.startDate || undefined,
      endDate: this.endDate || undefined,
      includeAssignments: true
    };

    this.managerService.getSchedule(params)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (response) => {
          if (response.success) {
            this.shifts = response.data.schedule;
            this.summary = response.data.summary;
          } else {
            this.error = 'Failed to load schedule';
          }
          this.loading = false;
        },
        error: (error) => {
          console.error('Error loading schedule:', error);
          this.error = 'Failed to load schedule. Please try again.';
          this.loading = false;
        }
      });
  }

  onFilterChange() {
    this.loadSchedule();
  }

  clearFilters() {
    this.fillStatusFilter = 'all';
    this.startDate = '';
    this.endDate = '';
    this.loadSchedule();
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

  getStatusColor(status: string): string {
    switch (status) {
      case 'fully_staffed':
        return 'bg-green-100 text-green-800';
      case 'partially_staffed':
        return 'bg-yellow-100 text-yellow-800';
      case 'unstaffed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  }

  getStatusText(status: string): string {
    switch (status) {
      case 'fully_staffed':
        return 'Fully Staffed';
      case 'partially_staffed':
        return 'Partially Staffed';
      case 'unstaffed':
        return 'Unstaffed';
      default:
        return status;
    }
  }

  getFillStatusText(fillPercentage: string): string {
    const percentage = parseFloat(fillPercentage);
    if (percentage === 100) return 'Complete';
    if (percentage >= 50) return 'Good';
    if (percentage > 0) return 'Needs Help';
    return 'Critical';
  }

  getFillStatusColor(fillPercentage: string): string {
    const percentage = parseFloat(fillPercentage);
    if (percentage === 100) return 'text-green-600';
    if (percentage >= 50) return 'text-yellow-600';
    if (percentage > 0) return 'text-orange-600';
    return 'text-red-600';
  }
}
