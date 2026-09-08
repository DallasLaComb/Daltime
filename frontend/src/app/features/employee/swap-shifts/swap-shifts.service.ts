import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import type { Observable } from 'rxjs';
import { environment } from '../../../../environments/environment';
import type {
  SwapShiftsResponse,
  SwapShift,
  PostSwapShiftBody,
} from '../../../core/models/swap-shift.model';
import type { Shift } from '../../../core/models/shift.model';

@Injectable({ providedIn: 'root' })
export class SwapShiftsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.api.baseUrl}/employee`;

  /**
   * Fetches both panels in one request.
   * GET /employee/swap-shifts returns { available, mine } so the UI doesn't
   * need two separate round-trips on page load.
   */
  list(): Observable<SwapShiftsResponse> {
    return this.http.get<SwapShiftsResponse>(`${this.baseUrl}/swap-shifts`);
  }

  /**
   * Posts one of the caller's own published shifts for swap.
   * POST /employee/swap-shifts → 201 with the created SwapShift record.
   * 409 means a listing for this shift already exists — caller should show a specific message.
   */
  postShift(shiftId: string): Observable<SwapShift> {
    const body: PostSwapShiftBody = { shift_id: shiftId };
    return this.http.post<SwapShift>(`${this.baseUrl}/swap-shifts`, body);
  }

  /**
   * Claims an open swap listing, transferring the shift to the caller.
   * POST /employee/swap-shifts/{swapId}/claim → 200 with the updated SwapShift.
   */
  claimShift(swapId: string): Observable<SwapShift> {
    return this.http.post<SwapShift>(`${this.baseUrl}/swap-shifts/${swapId}/claim`, {});
  }

  /**
   * Cancels an open listing the caller posted.
   * DELETE /employee/swap-shifts/{swapId} → 204 No Content.
   */
  cancelShift(swapId: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/swap-shifts/${swapId}`);
  }

  /**
   * Fetches the caller's own shifts for the current month.
   * Used to populate the shift picker when an employee wants to post a shift for swap.
   * GET /employee/shifts?month=YYYY-MM.
   */
  listMyShiftsForMonth(month: string): Observable<Shift[]> {
    return this.http.get<Shift[]>(`${this.baseUrl}/shifts`, { params: { month } });
  }
}
