import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { EventService } from './event.service';
import { CreateEventRequest, EventCalendar, EventInfo } from '../models/event.model';

describe('EventService', () => {
  let service: EventService;
  let http: HttpTestingController;

  const EVENT_ID = 'ev-123';
  const event: EventInfo = {
    id: EVENT_ID,
    name: 'Wakacje 2026',
    startDate: '2026-06-01',
    endDate: '2026-06-15',
    description: '',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(EventService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getEvents', () => {
    it('should GET /api/events', () => {
      service.getEvents().subscribe((events) => {
        expect(events).toEqual([event]);
      });

      const req = http.expectOne('/api/events');
      expect(req.request.method).toBe('GET');
      req.flush([event]);
    });
  });

  describe('getEvent', () => {
    it('should GET /api/events/{id}', () => {
      service.getEvent(EVENT_ID).subscribe((evt) => {
        expect(evt).toEqual(event);
      });

      const req = http.expectOne(`/api/events/${EVENT_ID}`);
      expect(req.request.method).toBe('GET');
      req.flush(event);
    });
  });

  describe('getEventCalendar', () => {
    it('should GET /api/events/{id}/calendar', () => {
      const expected: EventCalendar = { event, periods: [] };

      service.getEventCalendar(EVENT_ID).subscribe((calendar) => {
        expect(calendar).toEqual(expected);
      });

      const req = http.expectOne(`/api/events/${EVENT_ID}/calendar`);
      expect(req.request.method).toBe('GET');
      req.flush(expected);
    });
  });

  describe('createEvent', () => {
    it('should POST /api/events with the request body', () => {
      const body: CreateEventRequest = {
        name: 'Wakacje 2026',
        startDate: '2026-06-01',
        endDate: '2026-06-15',
      };

      service.createEvent(body).subscribe((evt) => {
        expect(evt).toEqual(event);
      });

      const req = http.expectOne('/api/events');
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(event);
    });
  });
});
