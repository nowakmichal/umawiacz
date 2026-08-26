import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateTimePeriodRequest, CreateTimePeriodResponse, Period } from '../models/period.model';

@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/periods';

  getPeriods(eventId: string): Observable<Period[]> {
    return this.http.get<Period[]>(`/api/events/${eventId}/periods`);
  }

  createPeriod(eventId: string, req: CreateTimePeriodRequest): Observable<CreateTimePeriodResponse> {
    return this.http.post<CreateTimePeriodResponse>(`/api/events/${eventId}/periods`, req);
  }

  deletePeriod(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
