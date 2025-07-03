import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../auth/auth.service';

export interface Assignment {
  assignmentId: string;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  phoneNumber: string;
  status: string;
  assignedAt: string;
  startTime: string;
  endTime: string;
  notes: string;
  ownershipHistory: any[];
  isTransferred: boolean;
  transferCount: number;
  originalOwner: any;
  currentOwner: any;
}

export interface Shift {
  shiftId: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  company: string;
  notes: string;
  requiredHeadcount: number;
  currentAssignedCount: string | number;
  fillStatus: 'fully_staffed' | 'partially_staffed' | 'unstaffed';
  fillPercentage: string;
  spotsRemaining: number;
  needsFilling: boolean;
  assignments: Assignment[];
  createdAt: string;
}

export interface ScheduleSummary {
  totalShifts: number;
  fullyStaffed: number;
  partiallyStaffed: number;
  unstaffed: number;
  totalSpotsNeeded: number;
  totalSpotsAssigned: number;
  totalSpotsRemaining: number;
  overallFillPercentage: number;
  shiftsNeedingFilling: number;
}

export interface ScheduleResponse {
  success: boolean;
  message: string;
  data: {
    schedule: Shift[];
    summary: ScheduleSummary;
    filters: {
      startDate: string | null;
      endDate: string | null;
      fillStatus: string;
      includeAssignments: boolean;
    };
    managerId: string;
  };
}

@Injectable({
  providedIn: 'root'
})
export class ManagerService {
  private baseUrl = environment.apiBaseUrl;

  constructor(
    private http: HttpClient,
    private authService: AuthService
  ) {}

  private getAuthHeaders(): HttpHeaders {
    const token = this.authService.getToken();
    return new HttpHeaders({
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    });
  }

  getSchedule(params?: {
    startDate?: string;
    endDate?: string;
    fillStatus?: string;
    includeAssignments?: boolean;
  }): Observable<ScheduleResponse> {
    let queryParams = new URLSearchParams();
    
    if (params?.startDate) {
      queryParams.append('startDate', params.startDate);
    }
    if (params?.endDate) {
      queryParams.append('endDate', params.endDate);
    }
    if (params?.fillStatus) {
      queryParams.append('fillStatus', params.fillStatus);
    }
    if (params?.includeAssignments !== undefined) {
      queryParams.append('includeAssignments', params.includeAssignments.toString());
    }

    const url = `${this.baseUrl}/managers/schedule${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return this.http.get<ScheduleResponse>(url, { headers: this.getAuthHeaders() });
  }
}
