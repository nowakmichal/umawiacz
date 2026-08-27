import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { Calendar } from './calendar';
import { PeriodService } from '../services/period.service';
import { EventService } from '../services/event.service';
import { AuthService } from '../services/auth.service';
import { SELECTION_COLORS, Period } from '../models/period.model';
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
      expect(component.isErasing()).toBe(false);
    });

    it('should deselect erase mode when selecting color', () => {
      component.toggleEraseMode();
      expect(component.isErasing()).toBe(true);

      component.selectColor('green');
      expect(component.isErasing()).toBe(false);
    });
  });

  describe('erase mode', () => {
    it('should toggle erase mode on and off', () => {
      expect(component.isErasing()).toBe(false);
      component.toggleEraseMode();
      expect(component.isErasing()).toBe(true);
      component.toggleEraseMode();
      expect(component.isErasing()).toBe(false);
    });

    it('should clear selection when entering erase mode', () => {
      component.selectionStart.set(new Date());
      component.toggleEraseMode();
      expect(component.selectionStart()).toBeNull();
    });
  });

  describe('selection flow', () => {
    it('should set selectionStart on first click', () => {
      const day = component.weeks()[2][3];
      component.onDayClick(day);
      expect(component.selectionStart()).toEqual(day.date);
    });

    it('should call createPeriod on second click', () => {
      component.currentUser.set('Ala');
      const resp = { id: 'new-id', start: '2026-06-15', end: '2026-06-16', color: 'green', userName: 'Ala' };
      periodService.createPeriod.mockReturnValue(of(resp));

      const day1 = { ...component.weeks()[2][3], date: new Date(2026, 5, 15) };
      const day2 = { ...component.weeks()[2][4], date: new Date(2026, 5, 16) };

      component.onDayClick(day1);
      component.onDayClick(day2);

      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-15',
        end: '2026-06-16',
        color: 'green',
        userName: 'Ala',
      });
      expect(component.periods().length).toBe(3);
      expect(component.selectionStart()).toBeNull();
    });

    it('should show error on 409 conflict', () => {
      component.currentUser.set('Ala');
      const err = new HttpErrorResponse({ status: 409 });
      periodService.createPeriod.mockReturnValue(throwError(() => err));

      const day1 = { ...component.weeks()[3][0], date: new Date(2026, 5, 20) };
      const day2 = { ...component.weeks()[3][1], date: new Date(2026, 5, 21) };
      component.onDayClick(day1);
      component.onDayClick(day2);

      expect(component.errorMessage()).toBe('Zaznaczyłeś już jeden lub więcej dni w tym zakresie.');
      expect(component.periods().length).toBe(2);
    });

    it('should add period locally on network error (fallback)', () => {
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(throwError(() => new Error('Network error')));

      const day1 = { ...component.weeks()[3][0], date: new Date(2026, 5, 20) };
      const day2 = { ...component.weeks()[3][1], date: new Date(2026, 5, 21) };
      component.onDayClick(day1);
      component.onDayClick(day2);

      expect(component.periods().length).toBe(3);
      expect(component.periods()[2].eventId).toBe(EVENT_ID);
      expect(component.selectionStart()).toBeNull();
    });

    it('should cancel selection', () => {
      component.selectionStart.set(new Date());
      component.hoverDate.set(new Date());
      component.cancelSelection();
      expect(component.selectionStart()).toBeNull();
      expect(component.hoverDate()).toBeNull();
    });
  });

  describe('isSelectionStart', () => {
    it('should return true for the selection start day', () => {
      const date = new Date(2026, 5, 15);
      component.selectionStart.set(date);
      const day = { date, inCurrentMonth: true, isToday: false, markings: [], isSelecting: false };
      expect(component.isSelectionStart(day)).toBe(true);
    });

    it('should return false for other days', () => {
      component.selectionStart.set(new Date(2026, 5, 15));
      const day = { date: new Date(2026, 5, 16), inCurrentMonth: true, isToday: false, markings: [], isSelecting: false };
      expect(component.isSelectionStart(day)).toBe(false);
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

    it('does not swallow the click on an unmarked day, so a tap starts the selection', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      const day = dayOfMonth(6);
      if (!day) return;

      component.onDayTouchStart(day, { currentTarget: cellFor(day) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBeNull();

      component.onDayClick(day);
      expect(component.selectionStart()).toEqual(day.date);
    });

    it('shows the tooltip on a marked day and swallows the following click', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      const day = dayOfMonth(1);
      if (!day) return;

      component.onDayTouchStart(day, { currentTarget: cellFor(day) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBe(day);

      component.onDayClick(day);
      expect(component.selectionStart()).toBeNull();
    });

    it('hides an open tooltip on a tap elsewhere and swallows that click', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      const marked = dayOfMonth(1);
      const other = dayOfMonth(6);
      if (!marked || !other) return;

      component.onDayTouchStart(marked, { currentTarget: cellFor(marked) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBe(marked);

      component.onDayTouchStart(other, { currentTarget: cellFor(other) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBeNull();

      component.onDayClick(other);
      expect(component.selectionStart()).toBeNull();
    });

    it('completes a range selection via two taps, without hover', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.createPeriod.mockReturnValue(
        of({ id: 't1', start: '2026-06-06', end: '2026-06-07', color: 'green', userName: 'Ala' }),
      );

      const day1 = dayOfMonth(6);
      const day2 = dayOfMonth(7);
      if (!day1 || !day2) return;

      component.onDayTouchStart(day1, { currentTarget: cellFor(day1) } as unknown as TouchEvent);
      component.onDayClick(day1);
      expect(component.selectionStart()).toEqual(day1.date);

      component.onDayTouchStart(day2, { currentTarget: cellFor(day2) } as unknown as TouchEvent);
      component.onDayClick(day2);

      expect(periodService.createPeriod).toHaveBeenCalledWith(EVENT_ID, {
        start: '2026-06-06',
        end: '2026-06-07',
        color: 'green',
        userName: 'Ala',
      });
      expect(component.selectionStart()).toBeNull();
    });

    it('keeps the selection active and skips the tooltip while selecting', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      const start = dayOfMonth(6);
      const marked = dayOfMonth(1);
      if (!start || !marked) return;

      component.selectionStart.set(start.date);
      component.onDayTouchStart(marked, { currentTarget: cellFor(marked) } as unknown as TouchEvent);

      expect(component.tooltipDay()).toBeNull();
      expect(component.selectionStart()).toEqual(start.date);
    });

    it('removes the own marking on tap while erasing, without showing the tooltip', () => {
      component.viewDate.set(new Date(2026, 5, 1));
      component.currentUser.set('Ala');
      periodService.deletePeriod.mockReturnValue(of(null));
      const day = dayOfMonth(1);
      if (!day) return;

      component.isErasing.set(true);
      component.onDayTouchStart(day, { currentTarget: cellFor(day) } as unknown as TouchEvent);
      expect(component.tooltipDay()).toBeNull();

      component.onDayClick(day);

      expect(periodService.deletePeriod).toHaveBeenCalledWith('p1');
      expect(component.periods().map((p) => p.id)).not.toContain('p1');
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
