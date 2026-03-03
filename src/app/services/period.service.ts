import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  CreateTimePeriodRequest,
  CreateTimePeriodResponse,
  TimePeriod,
} from '../models/time-period.model';

@Injectable({ providedIn: 'root' })
export class PeriodService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/periods';

  getPeriods(): Observable<TimePeriod[]> {
    return this.http.get<TimePeriod[]>(this.baseUrl);
  }

  createPeriod(req: CreateTimePeriodRequest): Observable<CreateTimePeriodResponse> {
    return this.http.post<CreateTimePeriodResponse>(this.baseUrl, req);
  }

  deletePeriod(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
