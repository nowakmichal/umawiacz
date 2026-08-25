import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { EventList } from './events';
import { EventService } from '../services/event.service';
import { EventInfo } from '../models/event.model';

function createEventServiceMock() {
  return {
    getEvents: vi.fn(),
    createEvent: vi.fn(),
  };
}

type MockEventService = ReturnType<typeof createEventServiceMock>;

const event1: EventInfo = {
  id: 'ev-1',
  name: 'Wakacje 2026',
  startDate: '2026-06-01',
  endDate: '2026-06-15',
  description: 'Wolne terminy',
};

describe('EventList', () => {
  let fixture: ComponentFixture<EventList>;
  let component: EventList;
  let eventService: MockEventService;
  let router: Router;

  beforeEach(async () => {
    vi.clearAllMocks();
    eventService = createEventServiceMock();
    eventService.getEvents.mockReturnValue(of([event1]));

    await TestBed.configureTestingModule({
      imports: [EventList],
      providers: [{ provide: EventService, useValue: eventService }],
    }).compileComponents();

    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(EventList);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load events on init', () => {
    expect(eventService.getEvents).toHaveBeenCalled();
    expect(component.isLoading()).toBe(false);
    expect(component.events()).toEqual([event1]);
    expect(fixture.nativeElement.querySelector('.event-card')).toBeTruthy();
  });

  it('should show empty state when there are no events', () => {
    eventService.getEvents.mockReturnValue(of([]));
    const f = TestBed.createComponent(EventList);
    f.detectChanges();

    expect(f.componentInstance.events()).toEqual([]);
    expect(f.nativeElement.querySelector('.empty-state')).toBeTruthy();
  });

  it('should show error banner when loading fails', () => {
    eventService.getEvents.mockReturnValue(throwError(() => new Error('boom')));
    const f = TestBed.createComponent(EventList);
    f.detectChanges();

    expect(f.componentInstance.loadError()).toBe('Nie udało się pobrać listy wydarzeń.');
    expect(f.nativeElement.querySelector('.error-banner')).toBeTruthy();
  });

  describe('openEvent', () => {
    it('should navigate to /calendar/:id', () => {
      const navSpy = vi.spyOn(router, 'navigate');

      component.openEvent('ev-1');

      expect(navSpy).toHaveBeenCalledWith(['/calendar', 'ev-1']);
    });
  });

  describe('create validation', () => {
    it('should show error when required fields are missing', () => {
      component.create();

      expect(component.createError()).toBe('Wypełnij nazwę, datę początkową i końcową.');
      expect(eventService.createEvent).not.toHaveBeenCalled();
    });

    it('should show error when start date is after end date', () => {
      component.name = 'Test';
      component.startDate = '2026-06-10';
      component.endDate = '2026-06-01';

      component.create();

      expect(component.createError()).toBe('Data początkowa nie może być późniejsza niż końcowa.');
      expect(eventService.createEvent).not.toHaveBeenCalled();
    });
  });

  describe('create success', () => {
    it('should append the new event sorted by start date and reset the form', () => {
      const newEvent: EventInfo = {
        id: 'ev-2',
        name: 'Nowe',
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        description: '',
      };
      eventService.createEvent.mockReturnValue(of(newEvent));
      component.name = ' Nowe ';
      component.startDate = '2026-07-01';
      component.endDate = '2026-07-05';
      component.description = '  opis  ';

      component.create();

      expect(eventService.createEvent).toHaveBeenCalledWith({
        name: 'Nowe',
        startDate: '2026-07-01',
        endDate: '2026-07-05',
        description: 'opis',
      });
      expect(component.events()).toEqual([event1, newEvent]);
      expect(component.name).toBe('');
      expect(component.startDate).toBe('');
      expect(component.endDate).toBe('');
      expect(component.description).toBe('');
      expect(component.isCreating()).toBe(false);

      fixture.detectChanges();
      expect(fixture.nativeElement.querySelectorAll('.event-card').length).toBe(2);
    });
  });

  describe('create error', () => {
    it('should show the server error message', () => {
      eventService.createEvent.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 400, error: { error: 'Zła nazwa' } })),
      );
      component.name = 'Test';
      component.startDate = '2026-07-01';
      component.endDate = '2026-07-05';

      component.create();

      expect(component.createError()).toBe('Zła nazwa');
      expect(component.isCreating()).toBe(false);
    });

    it('should show the generic message when the server error has no body', () => {
      eventService.createEvent.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      component.name = 'Test';
      component.startDate = '2026-07-01';
      component.endDate = '2026-07-05';

      component.create();

      expect(component.createError()).toBe('Nie udało się utworzyć wydarzenia. Spróbuj ponownie.');
    });
  });
});
