import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, Subject, throwError } from 'rxjs';
import { Calendar } from './calendar';
import { PeriodService } from '../services/period.service';
import { EventService } from '../services/event.service';
import { AuthService } from '../services/auth.service';
import { SELECTION_COLORS, Period, CreateTimePeriodRequest } from '../models/period.model';
import { Event } from '../models/event.model';
import { HttpErrorResponse } from '@angular/common/http';

const EVENT_ID = 'test-event';

const mockEvent: Event = {
  id: EVENT_ID,
  name: 'Wakacje 2026',
  startDate: '2026-06-01',
  endDate: '2026-06-15',
  description: 'Zaznaczcie dni, w których będziecie nieobecni',
};

function createPeriodServiceMock() {
  return {
    getPeriods: vi.fn(),
    createPeriod: vi.fn(),
    deletePeriod: vi.fn(),
  };
}

type MockPeriodService = ReturnType<typeof createPeriodServiceMock>;

function createEventServiceMock() {
  return {
    getEventCalendar: vi.fn(),
  };
}

type MockEventService = ReturnType<typeof createEventServiceMock>;

function createAuthServiceMock() {
  return {
    currentUser: vi.fn().mockReturnValue(null),
    logout: vi.fn(),
  };
}

type MockAuthService = ReturnType<typeof createAuthServiceMock>;

describe('Calendar', () => {
  let fixture: ComponentFixture<Calendar>;
  let component: Calendar;
  let periodService: MockPeriodService;
  let eventService: MockEventService;
  let authService: MockAuthService;
  let router: Router;

  const mockPeriods: Period[] = [
    { id: 'p1', eventId: EVENT_ID, start: '2026-06-01', end: '2026-06-05', color: 'green', userName: 'Ala' },
    { id: 'p2', eventId: EVENT_ID, start: '2026-06-10', end: '2026-06-12', color: 'red', userName: 'Ola' },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');

    periodService = createPeriodServiceMock();
    periodService.getPeriods.mockReturnValue(of(mockPeriods));

    eventService = createEventServiceMock();
    eventService.getEventCalendar.mockReturnValue(of({ event: mockEvent, periods: [] }));

    authService = createAuthServiceMock();

    await TestBed.configureTestingModule({
      imports: [Calendar],
      providers: [
        { provide: PeriodService, useValue: periodService },
        { provide: EventService, useValue: eventService },
        { provide: AuthService, useValue: authService },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: new Map([['eventId', EVENT_ID]]) } } },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();

    router = TestBed.inject(Router);

    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load periods on init', () => {
    expect(periodService.getPeriods).toHaveBeenCalledWith(EVENT_ID);
    expect(component.periods()).toEqual(mockPeriods);
  });

  describe('event loading', () => {
    it('should load the event via getEventCalendar(eventId)', () => {
      expect(eventService.getEventCalendar).toHaveBeenCalledWith(EVENT_ID);
      expect(component.eventInfo()).toEqual(mockEvent);
      expect(component.eventError()).toBeNull();
    });

    it('should render the error panel with the not-found message on 404', () => {
      eventService.getEventCalendar.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 404 })),
      );
      const f = TestBed.createComponent(Calendar);
      f.detectChanges();

      const comp = f.componentInstance;
      expect(comp.eventError()).toBe('Nie znaleziono wydarzenia. Sprawdź, czy link jest poprawny.');
      const el = f.nativeElement.querySelector('.event-error');
      expect(el).toBeTruthy();
      expect(el.textContent).toContain('Przejdź do wydarzeń');
    });

    it('should render the generic error message on other failures', () => {
      eventService.getEventCalendar.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 500 })),
      );
      const f = TestBed.createComponent(Calendar);
      f.detectChanges();

      expect(f.componentInstance.eventError()).toBe(
        'Nie udało się załadować kalendarza. Spróbuj ponownie.',
      );
      expect(f.nativeElement.querySelector('.event-error')).toBeTruthy();
    });
  });

  describe('username modal', () => {
    it('should show modal when no user is set', () => {
      const modal = fixture.nativeElement.querySelector('.user-modal-overlay');
      expect(modal).toBeTruthy();
    });

    it('should hide modal after calling confirmUsername', () => {
      component.usernameInput.set('  TestUser ');
      component.confirmUsername();
      fixture.detectChanges();

      expect(component.currentUser()).toBe('testuser');
      expect(localStorage.setItem).toHaveBeenCalledWith('umawiacz_username', 'testuser');
      const modal = fixture.nativeElement.querySelector('.user-modal-overlay');
      expect(modal).toBeFalsy();
    });

    it('should not set user for empty name', () => {
      component.usernameInput.set('  ');
      component.confirmUsername();

      expect(component.currentUser()).toBeNull();
      expect(localStorage.setItem).not.toHaveBeenCalled();
    });
  });

  describe('navigation', () => {
    it('should go to previous month', () => {
      const initial = component.viewDate();
      component.prevMonth();
      expect(component.viewDate().getMonth()).toBe(
        initial.getMonth() === 0 ? 11 : initial.getMonth() - 1,
      );
    });

    it('should go to next month', () => {
      const initial = component.viewDate();
      component.nextMonth();
      expect(component.viewDate().getMonth()).toBe(
        initial.getMonth() === 11 ? 0 : initial.getMonth() + 1,
      );
    });

    it('should go to today', () => {
      component.viewDate.set(new Date(2020, 5, 1));
      component.goToToday();
      const now = new Date();
      expect(component.viewDate().getFullYear()).toBe(now.getFullYear());
      expect(component.viewDate().getMonth()).toBe(now.getMonth());
    });
  });

  describe('month label', () => {
    it('should format month in Polish', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      expect(component.monthLabel()).toMatch(/czerwiec/);
    });
  });

  describe('color selection', () => {
    it('should select a color', () => {
      component.selectColor('red');
      expect(component.selectedColor()).toBe('red');
    });
  });

  describe('color legend', () => {
    function toolbarSwatches(): HTMLElement[] {
      fixture.detectChanges();
      return Array.from(fixture.nativeElement.querySelectorAll('.color-toolbar .color-swatch'));
    }

    function hexToRgb(hex: string): string {
      const n = parseInt(hex.slice(1), 16);
      return `rgb(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255})`;
    }

    it('shows a dot and a visible label for each selection color', () => {
      const swatches = toolbarSwatches();
      expect(swatches.length).toBe(SELECTION_COLORS.length);

      const labels = swatches.map(
        (s) => (s.querySelector('.swatch-label') as HTMLElement).textContent?.trim(),
      );
      expect(labels).toEqual(['Wolny', 'Zajęty']);

      swatches.forEach((s, i) => {
        const dot = s.querySelector('.swatch-dot') as HTMLElement;
        expect(dot.style.backgroundColor).toBe(hexToRgb(SELECTION_COLORS[i].hex));
      });
    });

    it('marks the selected color active in the toolbar', () => {
      component.selectColor('red');
      const swatches = toolbarSwatches();
      expect(swatches[0].classList.contains('active')).toBe(false);
      expect(swatches[1].classList.contains('active')).toBe(true);
    });

  });

  describe('selection flow', () => {
    it('should call createPeriod with a single-day period on one click', () => {
      component.currentUser.set('Ala');
      const resp = { id: 'new-id', start: '2026-06-15', end: '2026-06-15', color: 'green', userName: 'Ala' };
      periodService.createPeriod.mockReturnValue(of(resp));

      const day = { ...component.weeks()[2][3], date: new Date(2026, 5, 15) };
      component.onDayClick(day);

      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-15',
        end: '2026-06-15',
        color: 'green',
        userName: 'Ala',
      });
      expect(component.periods().length).toBe(3);
      expect(component.isSaving()).toBe(false);
    });

    it('resyncs silently on 409 conflict', () => {
      component.currentUser.set('Ala');
      const err = new HttpErrorResponse({ status: 409 });
      periodService.createPeriod.mockReturnValue(throwError(() => err));
      periodService.getPeriods.mockReturnValue(of([]));

      const day = { ...component.weeks()[3][0], date: new Date(2026, 5, 20) };
      component.onDayClick(day);

      expect(periodService.getPeriods).toHaveBeenCalledWith(EVENT_ID);
      expect(component.errorMessage()).toBeNull();
      expect(component.periods()).toEqual([]);
    });

    it('should add period locally on network error (fallback)', () => {
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(throwError(() => new Error('Network error')));

      const day = { ...component.weeks()[3][0], date: new Date(2026, 5, 20) };
      component.onDayClick(day);

      expect(component.periods().length).toBe(3);
      expect(component.periods()[2].eventId).toBe(EVENT_ID);
      expect(component.periods()[2].start).toBe('2026-06-20');
      expect(component.periods()[2].end).toBe('2026-06-20');
    });
  });

  describe('weeks grid', () => {
    it('should return 6 weeks (42 days)', () => {
      expect(component.weeks().length).toBe(6);
      expect(component.weeks().flat().length).toBe(42);
    });

    it('should include markings from periods', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      fixture.detectChanges();
      const allDays = component.weeks().flat();
      const marked = allDays.filter((d) => d.markings.length > 0);
      expect(marked.length).toBeGreaterThan(0);
    });
  });

  describe('own marking tint', () => {
    function dayCells(): HTMLElement[] {
      fixture.detectChanges();
      return Array.from(fixture.nativeElement.querySelectorAll('.day-cell'));
    }

    function dayOfMonth(n: number) {
      return component.weeks().flat().find((d) => d.inCurrentMonth && d.date.getDate() === n);
    }

    function cellFor(day: NonNullable<ReturnType<typeof dayOfMonth>>): HTMLElement {
      return dayCells()[component.weeks().flat().indexOf(day)];
    }

    it('tints the days the current user marked free with tint-free', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      fixture.detectChanges();

      const day = dayOfMonth(1);
      if (!day) return;

      expect(day.ownColor).toBe('green');
      expect(cellFor(day).classList.contains('tint-free')).toBe(true);
      expect(cellFor(day).classList.contains('tint-busy')).toBe(false);
    });

    it('tints the days the current user marked busy with tint-busy', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ola');
      fixture.detectChanges();

      const day = dayOfMonth(11);
      if (!day) return;

      expect(day.ownColor).toBe('red');
      expect(cellFor(day).classList.contains('tint-busy')).toBe(true);
      expect(cellFor(day).classList.contains('tint-free')).toBe(false);
    });

    it('does not tint days marked only by other users', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      fixture.detectChanges();

      const day = dayOfMonth(10);
      if (!day) return;

      expect(day.ownColor).toBeNull();
      expect(cellFor(day).classList.contains('tint-free')).toBe(false);
      expect(cellFor(day).classList.contains('tint-busy')).toBe(false);
    });

    it('tints no day for a guest without a current user', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      fixture.detectChanges();

      expect(component.weeks().flat().every((d) => d.ownColor === null)).toBe(true);
      expect(fixture.nativeElement.querySelector('.tint-free')).toBeNull();
      expect(fixture.nativeElement.querySelector('.tint-busy')).toBeNull();
    });
  });

  describe('own band', () => {
    function dayCells(): HTMLElement[] {
      fixture.detectChanges();
      return Array.from(fixture.nativeElement.querySelectorAll('.day-cell'));
    }

    function dayOfMonth(n: number) {
      return component.weeks().flat().find((d) => d.inCurrentMonth && d.date.getDate() === n);
    }

    function cellFor(day: NonNullable<ReturnType<typeof dayOfMonth>>): HTMLElement {
      return dayCells()[component.weeks().flat().indexOf(day)];
    }

    it('flags only the current user band with the own class', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.periods.update((list) => [
        ...list,
        {
          id: 'p3',
          eventId: EVENT_ID,
          start: '2026-06-01',
          end: '2026-06-03',
          color: 'red',
          userName: 'Ola',
        },
      ]);
      component.currentUser.set('ala');
      fixture.detectChanges();

      const day = dayOfMonth(1);
      if (!day) return;

      expect(day.markings.filter((m) => m.own).length).toBe(1);
      expect(day.markings.find((m) => m.periodId === 'p1')?.own).toBe(true);
      expect(day.markings.find((m) => m.periodId === 'p3')?.own).toBe(false);

      const bands = cellFor(day).querySelectorAll('.period-band');
      expect(bands.length).toBe(day.markings.length);
      bands.forEach((band, i) => {
        expect(band.classList.contains('own')).toBe(day.markings[i].own);
      });
    });

    it('marks no band as own when there is no current user', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      fixture.detectChanges();

      const bands = fixture.nativeElement.querySelectorAll('.period-band');
      expect(bands.length).toBeGreaterThan(0);
      expect(fixture.nativeElement.querySelector('.period-band.own')).toBeNull();
      expect(component.weeks().flat().every((d) => d.markings.every((m) => m.own === false))).toBe(
        true,
      );
    });
  });

  describe('tooltip', () => {
    it('should show tooltip on mouse enter over a marked day', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      const day = component.weeks().flat().find((d) => d.markings.length > 0);
      if (!day) return;

      const el = fixture.nativeElement.querySelector('.day-cell.has-markings') as HTMLElement;
      if (el) {
        component.onDayMouseEnter(day, { currentTarget: el } as unknown as MouseEvent);
        expect(component.tooltipDay()).toBe(day);
      }
    });

    it('should hide tooltip on mouse leave', () => {
      component.tooltipDay.set(component.weeks().flat()[0]);
      component.onDayMouseLeave();
      expect(component.tooltipDay()).toBeNull();
    });
  });

  describe('touch flow', () => {
    function dayCells(): HTMLElement[] {
      fixture.detectChanges();
      return Array.from(fixture.nativeElement.querySelectorAll('.day-cell'));
    }

    function dayOfMonth(n: number) {
      return component.weeks().flat().find((d) => d.inCurrentMonth && d.date.getDate() === n);
    }

    type CalDay = NonNullable<ReturnType<typeof dayOfMonth>>;

    function cellFor(day: CalDay): HTMLElement {
      return dayCells()[component.weeks().flat().indexOf(day)];
    }

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not swallow the click on an unmarked day, so a tap marks it', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(
        of({ id: 't3', start: '2026-06-06', end: '2026-06-06', color: 'green', userName: 'Ala' }),
      );
      const day = dayOfMonth(6);
      if (!day) return;

      component.onDayTouchStart(day, { currentTarget: cellFor(day) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBeNull();

      component.onDayClick(day);
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-06',
        end: '2026-06-06',
        color: 'green',
        userName: 'Ala',
      });
    });

    it('does not open the tooltip on a plain touch of a marked day; the tap marks it', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(
        of({ id: 't4', start: '2026-06-10', end: '2026-06-10', color: 'green', userName: 'Ala' }),
      );
      const day = dayOfMonth(10);
      if (!day) return;

      component.onDayTouchStart(day, { currentTarget: cellFor(day) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBeNull();

      component.onDayClick(day);
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-10',
        end: '2026-06-10',
        color: 'green',
        userName: 'Ala',
      });
    });

    it('opens the tooltip on a long press of a marked day and swallows the following click', () => {
      vi.useFakeTimers();
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(
        of({ id: 't5', start: '2026-06-01', end: '2026-06-01', color: 'green', userName: 'Ala' }),
      );
      const day = dayOfMonth(1);
      if (!day) return;

      component.onDayTouchStart(day, { currentTarget: cellFor(day) } as unknown as TouchEvent);
      vi.advanceTimersByTime(449);
      expect(component.tooltipDay()).toBeNull();

      vi.advanceTimersByTime(1);
      expect(component.tooltipDay()).toBe(day);

      component.onDayClick(day);
      expect(periodService.createPeriod).not.toHaveBeenCalled();
    });

    it('cancels the pending long press on a quick tap, so the tap marks the day', () => {
      vi.useFakeTimers();
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(
        of({ id: 't6', start: '2026-06-06', end: '2026-06-06', color: 'green', userName: 'Ala' }),
      );
      const day = dayOfMonth(6);
      if (!day) return;

      component.onDayTouchStart(day, { currentTarget: cellFor(day) } as unknown as TouchEvent);
      component.cancelLongPress();
      vi.advanceTimersByTime(500);
      expect(component.tooltipDay()).toBeNull();

      component.onDayClick(day);
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-06',
        end: '2026-06-06',
        color: 'green',
        userName: 'Ala',
      });
    });

    it('hides an open tooltip on a tap elsewhere and swallows that click', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      const marked = dayOfMonth(1);
      const other = dayOfMonth(6);
      if (!marked || !other) return;

      component.tooltipDay.set(marked);

      component.onDayTouchStart(other, { currentTarget: cellFor(other) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBeNull();

      component.onDayClick(other);
      expect(periodService.createPeriod).not.toHaveBeenCalled();
    });

  });

  describe('click flow', () => {
    function dayOfMonth(n: number) {
      return component.weeks().flat().find((d) => d.inCurrentMonth && d.date.getDate() === n);
    }

    it('creates a one-day period on a single click', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(
        of({ id: 'sd1', start: '2026-06-15', end: '2026-06-15', color: 'green', userName: 'Ala' }),
      );

      const day = dayOfMonth(15);
      if (!day) return;

      component.onDayClick(day);

      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-15',
        end: '2026-06-15',
        color: 'green',
        userName: 'Ala',
      });
      expect(component.periods().length).toBe(3);
    });

    it('unmarks an own day when the selected color matches', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.deletePeriod.mockReturnValue(of(null));

      const day = dayOfMonth(1);
      if (!day) return;

      component.onDayClick(day);

      expect(periodService.deletePeriod).toHaveBeenCalledWith('p1');
      expect(periodService.createPeriod).not.toHaveBeenCalled();
      expect(component.errorMessage()).toBeNull();
      expect(component.periods().length).toBe(1);
      expect(component.periods()[0].id).toBe('p2');
    });

    it('recolors an own day when a different color is selected', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      component.selectColor('red');
      periodService.deletePeriod.mockReturnValue(of(null));
      periodService.createPeriod.mockReturnValue(
        of({ id: 'rc1', start: '2026-06-01', end: '2026-06-01', color: 'red', userName: 'Ala' }),
      );

      const day = dayOfMonth(1);
      if (!day) return;

      component.onDayClick(day);

      expect(periodService.deletePeriod).toHaveBeenCalledWith('p1');
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-01',
        end: '2026-06-01',
        color: 'red',
        userName: 'Ala',
      });
      expect(component.periods().length).toBe(2);
      expect(component.periods().map((p) => p.id)).toEqual(['p2', 'rc1']);
    });

    it('issues the recolor create only after the delete completes (chained)', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      component.selectColor('red');
      const delete$ = new Subject<void>();
      periodService.deletePeriod.mockReturnValue(delete$);
      periodService.createPeriod.mockReturnValue(
        of({ id: 'rc2', start: '2026-06-01', end: '2026-06-01', color: 'red', userName: 'Ala' }),
      );

      const day = dayOfMonth(1);
      if (!day) return;

      component.onDayClick(day);

      expect(periodService.deletePeriod).toHaveBeenCalledWith('p1');
      expect(periodService.createPeriod).not.toHaveBeenCalled();

      delete$.next();
      delete$.complete();

      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-01',
        end: '2026-06-01',
        color: 'red',
        userName: 'Ala',
      });
      expect(component.periods().map((p) => p.id)).toEqual(['p2', 'rc2']);
    });

    it('marks a day marked only by other users for the current user', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(
        of({ id: 'ot1', start: '2026-06-10', end: '2026-06-10', color: 'green', userName: 'Ala' }),
      );

      const day = dayOfMonth(10);
      if (!day) return;

      component.onDayClick(day);

      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-10',
        end: '2026-06-10',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.deletePeriod).not.toHaveBeenCalled();
      expect(component.periods().length).toBe(3);
    });
  });

  describe('swipe selection', () => {
    function dayCells(): HTMLElement[] {
      fixture.detectChanges();
      return Array.from(fixture.nativeElement.querySelectorAll('.day-cell'));
    }

    function dayOfMonth(n: number) {
      return component.weeks().flat().find((d) => d.inCurrentMonth && d.date.getDate() === n);
    }

    type CalDay = NonNullable<ReturnType<typeof dayOfMonth>>;

    function cellFor(day: CalDay): HTMLElement {
      return dayCells()[component.weeks().flat().indexOf(day)];
    }

    // jsdom has no Touch/TouchList and no document.elementFromPoint, so build the
    // touch events by hand and stub elementFromPoint with the rendered cells.
    function touchEvent(type: string, cell: HTMLElement, x: number, y: number): TouchEvent {
      const ev = new TouchEvent(type, { bubbles: true, cancelable: true });
      const touch = { identifier: 0, target: cell, clientX: x, clientY: y };
      Object.defineProperty(ev, 'touches', { configurable: true, get: () => [touch] });
      return ev;
    }

    function mouseEvent(type: string, cell: HTMLElement, x: number, y: number): MouseEvent {
      return new MouseEvent(type, { bubbles: true, cancelable: true, clientX: x, clientY: y });
    }

    let restoreElementFromPoint: (() => void) | null = null;

    function stubElementFromPoint(impl: (x: number, y: number) => Element | null): void {
      const original = document.elementFromPoint;
      document.elementFromPoint = impl;
      restoreElementFromPoint = () => {
        document.elementFromPoint = original;
      };
    }

    function mockCreate(): void {
      periodService.createPeriod.mockImplementation(
        (eventId: string, req: CreateTimePeriodRequest) =>
          of({
            id: `sw-${req.start}`,
            start: req.start,
            end: req.end,
            color: req.color,
            userName: req.userName,
          }),
      );
    }

    afterEach(() => {
      restoreElementFromPoint?.();
      restoreElementFromPoint = null;
    });

    it('marks the anchor day and every day a touch swipe passes over, and swallows the release click', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      mockCreate();

      const a = dayOfMonth(6);
      const b = dayOfMonth(7);
      const c = dayOfMonth(8);
      if (!a || !b || !c) return;
      const cellA = cellFor(a);
      const cellB = cellFor(b);
      const cellC = cellFor(c);

      stubElementFromPoint((x) => (x < 105 ? cellA : x < 120 ? cellB : cellC));

      cellA.dispatchEvent(touchEvent('touchstart', cellA, 100, 100));
      fixture.detectChanges();
      expect(cellA.classList.contains('selecting')).toBe(true);
      cellA.dispatchEvent(touchEvent('touchmove', cellA, 115, 100));
      fixture.detectChanges();
      expect(cellB.classList.contains('selecting')).toBe(true);
      cellA.dispatchEvent(touchEvent('touchmove', cellA, 125, 100));
      cellA.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));

      expect(periodService.createPeriod).toHaveBeenCalledTimes(3);
      expect(periodService.createPeriod.mock.calls.map((call) => call[1].start)).toEqual([
        '2026-06-06',
        '2026-06-07',
        '2026-06-08',
      ]);
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-06',
        end: '2026-06-06',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-07',
        end: '2026-06-07',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-08',
        end: '2026-06-08',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.deletePeriod).not.toHaveBeenCalled();
      expect(component.previewDays()).toEqual([]);

      cellC.click();
      expect(periodService.createPeriod).toHaveBeenCalledTimes(3);
    });

    it('issues no request for days already marked in the selected color and marks the rest of the swipe path', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      mockCreate();

      // Ala owns 2026-06-01..05 (period p1): days 3-5 are pre-marked, day 6 is free
      const a = dayOfMonth(3);
      const b = dayOfMonth(4);
      const c = dayOfMonth(5);
      const d = dayOfMonth(6);
      if (!a || !b || !c || !d) return;
      const cellA = cellFor(a);
      const cellB = cellFor(b);
      const cellC = cellFor(c);
      const cellD = cellFor(d);

      stubElementFromPoint((x) => (x < 105 ? cellA : x < 118 ? cellB : x < 128 ? cellC : cellD));

      cellA.dispatchEvent(touchEvent('touchstart', cellA, 100, 100));
      cellA.dispatchEvent(touchEvent('touchmove', cellA, 115, 100));
      cellA.dispatchEvent(touchEvent('touchmove', cellA, 125, 100));
      cellA.dispatchEvent(touchEvent('touchmove', cellA, 135, 100));
      cellA.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));

      expect(periodService.createPeriod).toHaveBeenCalledTimes(1);
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-06',
        end: '2026-06-06',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.deletePeriod).not.toHaveBeenCalled();

      cellD.click();
      expect(periodService.createPeriod).toHaveBeenCalledTimes(1);
    });

    it('repaints the own-marked day a touch swipe starts on with the selected color', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      component.selectColor('red');
      periodService.deletePeriod.mockReturnValue(of(null));
      mockCreate();

      // Ala owns 2026-06-01..05 (period p1, green): the swipe starts on own-marked
      // day 3 and continues onto the free day 6
      const a = dayOfMonth(3);
      const d = dayOfMonth(6);
      if (!a || !d) return;
      const cellA = cellFor(a);
      const cellD = cellFor(d);

      stubElementFromPoint((x) => (x < 110 ? cellA : cellD));

      cellA.dispatchEvent(touchEvent('touchstart', cellA, 100, 100));
      cellA.dispatchEvent(touchEvent('touchmove', cellA, 120, 100));
      cellA.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));

      expect(periodService.deletePeriod).toHaveBeenCalledTimes(1);
      expect(periodService.deletePeriod).toHaveBeenCalledWith('p1');
      expect(periodService.createPeriod).toHaveBeenCalledTimes(2);
      expect(periodService.createPeriod.mock.calls.map((call) => call[1])).toEqual([
        { start: '2026-06-03', end: '2026-06-03', color: 'red', userName: 'Ala' },
        { start: '2026-06-06', end: '2026-06-06', color: 'red', userName: 'Ala' },
      ]);
    });

    it('treats a touch that moves below the swipe threshold as a tap', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      mockCreate();

      const a = dayOfMonth(6);
      if (!a) return;
      const cellA = cellFor(a);

      stubElementFromPoint(() => cellA);

      cellA.dispatchEvent(touchEvent('touchstart', cellA, 100, 100));
      cellA.dispatchEvent(touchEvent('touchmove', cellA, 105, 100));
      cellA.dispatchEvent(new TouchEvent('touchend', { bubbles: true, cancelable: true }));

      expect(periodService.createPeriod).not.toHaveBeenCalled();
      expect(component.previewDays()).toEqual([]);

      cellA.click();
      expect(periodService.createPeriod).toHaveBeenCalledTimes(1);
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-06',
        end: '2026-06-06',
        color: 'green',
        userName: 'Ala',
      });
    });

    it('marks the anchor day and every day a mouse drag passes over, and swallows the release click', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      mockCreate();

      const a = dayOfMonth(6);
      const b = dayOfMonth(7);
      const c = dayOfMonth(8);
      if (!a || !b || !c) return;
      const cellA = cellFor(a);
      const cellB = cellFor(b);
      const cellC = cellFor(c);

      stubElementFromPoint((x) => (x < 105 ? cellA : x < 120 ? cellB : cellC));

      cellA.dispatchEvent(mouseEvent('mousedown', cellA, 100, 100));
      cellB.dispatchEvent(mouseEvent('mousemove', cellB, 115, 100));
      cellC.dispatchEvent(mouseEvent('mousemove', cellC, 125, 100));
      cellC.dispatchEvent(mouseEvent('mouseup', cellC, 125, 100));

      expect(periodService.createPeriod).toHaveBeenCalledTimes(3);
      expect(periodService.createPeriod.mock.calls.map((call) => call[1].start)).toEqual([
        '2026-06-06',
        '2026-06-07',
        '2026-06-08',
      ]);
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-06',
        end: '2026-06-06',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-07',
        end: '2026-06-07',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-08',
        end: '2026-06-08',
        color: 'green',
        userName: 'Ala',
      });
      expect(periodService.deletePeriod).not.toHaveBeenCalled();

      cellC.click();
      expect(periodService.createPeriod).toHaveBeenCalledTimes(3);
    });

    it('repaints the own-marked day a mouse drag starts on with the selected color', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      component.selectColor('red');
      periodService.deletePeriod.mockReturnValue(of(null));
      mockCreate();

      const a = dayOfMonth(3);
      const d = dayOfMonth(6);
      if (!a || !d) return;
      const cellA = cellFor(a);
      const cellD = cellFor(d);

      stubElementFromPoint((x) => (x < 110 ? cellA : cellD));

      cellA.dispatchEvent(mouseEvent('mousedown', cellA, 100, 100));
      cellD.dispatchEvent(mouseEvent('mousemove', cellD, 120, 100));
      cellD.dispatchEvent(mouseEvent('mouseup', cellD, 120, 100));

      expect(periodService.deletePeriod).toHaveBeenCalledTimes(1);
      expect(periodService.deletePeriod).toHaveBeenCalledWith('p1');
      expect(periodService.createPeriod).toHaveBeenCalledTimes(2);
      expect(periodService.createPeriod.mock.calls.map((call) => call[1])).toEqual([
        { start: '2026-06-03', end: '2026-06-03', color: 'red', userName: 'Ala' },
        { start: '2026-06-06', end: '2026-06-06', color: 'red', userName: 'Ala' },
      ]);
    });
  });

  describe('error banner', () => {
    it('should show and dismiss error', () => {
      component.errorMessage.set('Something went wrong');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-banner')).toBeTruthy();

      component.errorMessage.set(null);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-banner')).toBeFalsy();
    });

    it('should render a close button when the error is shown and hide the banner when clicked', () => {
      component.errorMessage.set('Something went wrong');
      fixture.detectChanges();
      const close = fixture.nativeElement.querySelector('.error-close') as HTMLButtonElement;
      expect(close).toBeTruthy();

      close.click();
      fixture.detectChanges();
      expect(component.errorMessage()).toBeNull();
      expect(fixture.nativeElement.querySelector('.error-banner')).toBeFalsy();
    });

    it('should not render the close button when there is no error', () => {
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-close')).toBeFalsy();
    });

    it('clearError should clear the error signal', () => {
      component.errorMessage.set('Something went wrong');
      component.clearError();
      expect(component.errorMessage()).toBeNull();
    });
  });

  describe('copyLink', () => {
    it('should set the copied state', () => {
      expect(component.copiedLink()).toBe(false);
      component.copyLink();
      expect(component.copiedLink()).toBe(true);
    });
  });

  describe('logout', () => {
    it('should clear currentUser and call authService.logout without navigation', () => {
      component.currentUser.set('ala');
      const navSpy = vi.spyOn(router, 'navigate');

      component.logout();

      expect(authService.logout).toHaveBeenCalled();
      expect(component.currentUser()).toBeNull();
      expect(navSpy).not.toHaveBeenCalled();
    });
  });

  describe('weekDays', () => {
    it('should contain Polish day abbreviations', () => {
      expect(component.weekDays).toEqual(['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']);
    });
  });

  describe('selectionColors', () => {
    it('should match the model', () => {
      expect(component.selectionColors).toEqual(SELECTION_COLORS);
    });
  });
});
