import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PLATFORM_ID } from '@angular/core';
import { of, throwError } from 'rxjs';
import { Calendar } from './calendar';
import { PeriodService } from '../services/period.service';
import { SELECTION_COLORS, TimePeriod } from '../models/time-period.model';
import { HttpErrorResponse } from '@angular/common/http';

function createPeriodServiceMock() {
  return {
    getPeriods: vi.fn(),
    createPeriod: vi.fn(),
    deletePeriod: vi.fn(),
  };
}

type MockPeriodService = ReturnType<typeof createPeriodServiceMock>;

describe('Calendar', () => {
  let fixture: ComponentFixture<Calendar>;
  let component: Calendar;
  let periodService: MockPeriodService;

  const mockPeriods: TimePeriod[] = [
    { id: 'p1', start: '2026-06-01', end: '2026-06-05', color: 'green', userName: 'Ala' },
    { id: 'p2', start: '2026-06-10', end: '2026-06-12', color: 'orange', userName: 'Ola' },
  ];

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null);
    vi.spyOn(Storage.prototype, 'setItem');

    periodService = createPeriodServiceMock();
    periodService.getPeriods.mockReturnValue(of(mockPeriods));

    await TestBed.configureTestingModule({
      imports: [Calendar],
      providers: [
        { provide: PeriodService, useValue: periodService },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(Calendar);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should load periods on init', () => {
    expect(periodService.getPeriods).toHaveBeenCalled();
    expect(component.periods().length).toBe(2);
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

      component.selectColor('orange');
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

      expect(periodService.createPeriod).toHaveBeenCalledWith({
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

  describe('error banner', () => {
    it('should show and dismiss error', () => {
      component.errorMessage.set('Something went wrong');
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-banner')).toBeTruthy();

      // Since we removed dismissError, test that error is cleared by setting to null
      component.errorMessage.set(null);
      fixture.detectChanges();
      expect(fixture.nativeElement.querySelector('.error-banner')).toBeFalsy();
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
