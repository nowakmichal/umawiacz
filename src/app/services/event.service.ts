import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEventRequest, Event, EventCalendar } from '../models/event.model';

@Injectable({ providedIn: 'root' })
export class EventService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = '/api/events';

  getEvents(): Observable<Event[]> {
    return this.http.get<Event[]>(this.baseUrl);
  }

  getEventCalendar(id: string): Observable<EventCalendar> {
    return this.http.get<EventCalendar>(`${this.baseUrl}/${id}/calendar`);
  }

  createEvent(req: CreateEventRequest): Observable<Event> {
    return this.http.post<Event>(this.baseUrl, req);
  }
}
