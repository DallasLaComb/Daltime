import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type { Shift } from '../../../core/models/shift.model';

@Injectable({ providedIn: 'root' })
export class EmployeeShiftsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/employee`;

  /**
   * Fetches all of the caller's shifts for a full calendar month.
   * Used by month view. Calls GET /employee/shifts?month=YYYY-MM.
   */
  listByMonth(month: string): Observable<Shift[]> {
    return this.http.get<Shift[]>(`${this.baseUrl}/shifts`, { params: { month } });
  }

  /**
   * Fetches all of the caller's shifts for a single day.
   * Used by day view. Calls GET /employee/shifts?date=YYYY-MM-DD.
   */
  listByDate(date: string): Observable<Shift[]> {
    return this.http.get<Shift[]>(`${this.baseUrl}/shifts`, { params: { date } });
  }

  /**
   * Fetches all of the caller's shifts for a 7-day window starting on weekStart.
   * Used by week view. Calls GET /employee/shifts?week=YYYY-MM-DD.
   */
  listByWeek(weekStart: string): Observable<Shift[]> {
    return this.http.get<Shift[]>(`${this.baseUrl}/shifts`, { params: { week: weekStart } });
  }

  /**
   * Fetches shifts from other employees in the same org that are available for pickup on a date.
   * Used by day view's "Available from coworkers" section.
   * Calls GET /employee/available-shifts?date=YYYY-MM-DD.
   * Returns empty array (never 404) when no available shifts exist.
   */
  listAvailableShifts(date: string): Observable<Shift[]> {
    return this.http.get<Shift[]>(`${this.baseUrl}/available-shifts`, { params: { date } });
  }
}
