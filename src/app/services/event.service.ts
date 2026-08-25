import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEventRequest, EventCalendar, EventInfo } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/events';

  getEvents(): Observable<EventInfo[]> {
    return this.http.get<EventInfo[]>(this.baseUrl);
  }

  getEvent(id: string): Observable<EventInfo> {
    return this.http.get<EventInfo>(`${this.baseUrl}/${id}`);
  }

  getEventCalendar(id: string): Observable<EventCalendar> {
    return this.http.get<EventCalendar>(`${this.baseUrl}/${id}/calendar`);
  }

  createEvent(req: CreateEventRequest): Observable<EventInfo> {
    return this.http.post<EventInfo>(this.baseUrl, req);
  }
}
