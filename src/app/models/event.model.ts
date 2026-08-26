import { Period } from './period.model';

export interface Event {
  id: string;
  name: string;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string; // ISO date YYYY-MM-DD
  description: string;
}

export interface CreateEventRequest {
  name: string;
  startDate: string; // ISO date YYYY-MM-DD
  endDate: string; // ISO date YYYY-MM-DD
  description?: string;
}

export interface EventCalendar {
  event: Event;
  periods: Period[];
}
