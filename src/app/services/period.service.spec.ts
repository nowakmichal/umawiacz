import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { PeriodService } from './period.service';
import { CreateTimePeriodRequest, Period } from '../models/period.model';

describe('PeriodService', () => {
  let service: PeriodService;
  let http: HttpTestingController;

  const EVENT_ID = 'ev-123';

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PeriodService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('getPeriods', () => {
    it('should GET /api/events/{eventId}/periods', () => {
      const expected: Period[] = [
        {
          id: '1',
          eventId: EVENT_ID,
          start: '2026-06-01',
          end: '2026-06-05',
          color: 'green',
          userName: 'Ala',
        },
      ];

      service.getPeriods(EVENT_ID).subscribe((periods) => {
        expect(periods).toEqual(expected);
      });

      const req = http.expectOne(`/api/events/${EVENT_ID}/periods`);
      expect(req.request.method).toBe('GET');
      req.flush(expected);
    });
  });

  describe('createPeriod', () => {
    it('should POST /api/events/{eventId}/periods with the request body', () => {
      const body: CreateTimePeriodRequest = {
        start: '2026-06-01',
        end: '2026-06-05',
        color: 'green',
        userName: 'Ala',
      };
      const response = { id: 'new-id', ...body };

      service.createPeriod(EVENT_ID, body).subscribe((resp) => {
        expect(resp).toEqual(response);
      });

      const req = http.expectOne(`/api/events/${EVENT_ID}/periods`);
      expect(req.request.method).toBe('POST');
      expect(req.request.body).toEqual(body);
      req.flush(response);
    });
  });

  describe('deletePeriod', () => {
    it('should DELETE /api/periods/{id}', () => {
      service.deletePeriod('abc-123').subscribe();

      const req = http.expectOne('/api/periods/abc-123');
      expect(req.request.method).toBe('DELETE');
      req.flush(null, { status: 204, statusText: 'No Content' });
    });
  });
});
