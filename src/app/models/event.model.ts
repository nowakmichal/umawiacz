import { TimePeriod } from './time-period.model';

export interface EventInfo {
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
  event: EventInfo;
  periods: TimePeriod[];
}
