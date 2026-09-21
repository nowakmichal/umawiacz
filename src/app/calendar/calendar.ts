import {
  Component,
  DestroyRef,
  ElementRef,
  OnDestroy,
  OnInit,
  PLATFORM_ID,
  afterNextRender,
  computed,
  inject,
  signal,
} from '@angular/core';
import { isPlatformBrowser, CommonModule } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { interval, startWith, switchMap } from 'rxjs';
import { SELECTION_COLORS, SelectionColor, Period } from '../models/period.model';
import { Event } from '../models/event.model';
import { PeriodService } from '../services/period.service';
import { EventService } from '../services/event.service';
import { AuthService } from '../services/auth.service';

interface DayMarking {
  periodId: string;
  userName: string;
  color: string; // hex
  colorLabel: string;
  own: boolean;
}

interface CalendarDay {
  date: Date;
  inCurrentMonth: boolean;
  isToday: boolean;
  markings: DayMarking[];
  ownColor: SelectionColor | null;
}

const POLL_INTERVAL_MS = 15_000;
const LONG_PRESS_MS = 450;
const SWIPE_THRESHOLD_PX = 10;
const USERNAME_KEY = 'umawiacz_username';
const EVENT_NOT_FOUND_MSG = 'Nie znaleziono wydarzenia. Sprawdź, czy link jest poprawny.';
const EVENT_LOAD_ERROR_MSG = 'Nie udało się załadować kalendarza. Spróbuj ponownie.';
const RESYNC_ERROR_MSG = 'Nie udało się zsynchronizować kalendarza. Spróbuj ponownie.';

@Component({
  selector: 'app-calendar',
  imports: [CommonModule, RouterLink],
  templateUrl: './calendar.html',
  styleUrl: './calendar.scss',
})
export class Calendar implements OnInit, OnDestroy {
  private readonly today = new Date();
  private readonly periodService = inject(PeriodService);
  private readonly eventService = inject(EventService);
  private readonly authService = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly platformId = inject(PLATFORM_ID);
  private readonly elementRef = inject(ElementRef);
  private readonly route = inject(ActivatedRoute);

  // Flag to swallow the synthetic click that follows a tooltip dismiss or a long-press touch
  private pendingClickSwallow = false;
  private longPressTimer: number | null = null;

  // Swipe (touch) gesture state: anchor cell + start point, accumulated preview below
  private swipeAnchor: string | null = null;
  private swipeStartX = 0;
  private swipeStartY = 0;
  private swipeMoved = false;

  // Mouse swipe gesture state
  private pressAnchor: string | null = null;
  private pressStartX = 0;
  private pressStartY = 0;
  private pressMoved = false;

  readonly eventId = this.route.snapshot.paramMap.get('eventId') ?? '';

  readonly selectionColors = SELECTION_COLORS;

  readonly viewDate = signal(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  readonly selectedColor = signal<SelectionColor>('green');
  readonly periods = signal<Period[]>([]);
  readonly isSaving = signal(false);

  readonly eventInfo = signal<Event | null>(null);
  readonly eventError = signal<string | null>(null);
  readonly copiedLink = signal(false);

  readonly currentUser = signal<string | null>(null);
  readonly usernameInput = signal('');
  readonly errorMessage = signal<string | null>(null);

  readonly tooltipDay = signal<CalendarDay | null>(null);
  readonly tooltipPos = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  readonly tooltipAbove = signal(true);

  readonly previewDays = signal<string[]>([]);

  readonly monthLabel = computed(() =>
    this.viewDate().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' }),
  );

  readonly eventDateLabel = computed(() => {
    const evt = this.eventInfo();
    if (!evt) return '';
    const start = formatPlDate(evt.startDate);
    if (evt.startDate === evt.endDate) return start;
    return `${start} – ${formatPlDate(evt.endDate)}`;
  });

  readonly weeks = computed<CalendarDay[][]>(() => {
    const view = this.viewDate();
    const year = view.getFullYear();
    const month = view.getMonth();

    const firstDay = new Date(year, month, 1);
    const startOffset = (firstDay.getDay() + 6) % 7;
    const gridStart = new Date(firstDay);
    gridStart.setDate(gridStart.getDate() - startOffset);

    const activePeriods = this.periods();
    const user = this.currentUser()?.trim().toLowerCase() || null;

    const colorMap = new Map(SELECTION_COLORS.map((c) => [c.value, c.hex]));
    const labelMap = new Map(SELECTION_COLORS.map((c) => [c.value, c.label]));

    const days: CalendarDay[] = [];
    const cursor = new Date(gridStart);

    for (let i = 0; i < 42; i++) {
      const date = new Date(cursor);
      const dateStr = toIsoDate(date);

      const matchingPeriods = activePeriods.filter(
        (p) => p.start <= dateStr && dateStr <= p.end,
      );
      const markings: DayMarking[] = matchingPeriods.map((p) => ({
        periodId: p.id,
        userName: p.userName,
        color: colorMap.get(p.color) ?? '#000',
        colorLabel: labelMap.get(p.color) ?? p.color,
        own: user ? p.userName.trim().toLowerCase() === user : false,
      }));
      const ownPeriod = user
        ? matchingPeriods.find((p) => p.userName.trim().toLowerCase() === user)
        : undefined;
      const ownColor = ownPeriod ? ownPeriod.color : null;

      days.push({
        date,
        inCurrentMonth: date.getMonth() === month,
        isToday: this.isSameDay(date, this.today),
        markings,
        ownColor,
      });
      cursor.setDate(cursor.getDate() + 1);
    }

    return Array.from({ length: 6 }, (_, i) => days.slice(i * 7, i * 7 + 7));
  });

  readonly weekDays = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

  constructor() {
    // afterNextRender requires an injection context (ngOnInit has none -> NG0203);
    // the constructor also runs during client bootstrap after SSR hydration.
    // On the server it is a no-op, so the browser guard is only for clarity.
    if (isPlatformBrowser(this.platformId)) {
      afterNextRender(() => {
        const user = this.authService.currentUser();
        this.currentUser.set(user ? user.username : localStorage.getItem(USERNAME_KEY));
      });
    }
  }

  ngOnDestroy(): void {
    this.cancelLongPress();
  }

  ngOnInit(): void {
    if (!this.eventId) {
      this.eventError.set(EVENT_NOT_FOUND_MSG);
      return;
    }

    this.eventService.getEventCalendar(this.eventId).subscribe({
      next: ({ event, periods }) => {
        this.eventInfo.set(event);
        this.periods.set(periods);
      },
      error: (err: HttpErrorResponse) => {
        this.eventError.set(err.status === 404 ? EVENT_NOT_FOUND_MSG : EVENT_LOAD_ERROR_MSG);
      },
    });

    interval(POLL_INTERVAL_MS)
      .pipe(
        startWith(0),
        switchMap(() => this.periodService.getPeriods(this.eventId)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (periods) => this.periods.set(periods),
        error: () => {},
      });
  }

  confirmUsername(): void {
    const name = this.usernameInput().trim().toLowerCase();
    if (!name) return;
    localStorage.setItem(USERNAME_KEY, name);
    this.currentUser.set(name);
  }

  copyLink(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const url = `${window.location.origin}/calendar/${this.eventId}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    this.copiedLink.set(true);
    setTimeout(() => {
      this.copiedLink.set(false);
    }, 2000);
  }

  prevMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() - 1, 1));
  }

  nextMonth(): void {
    const d = this.viewDate();
    this.viewDate.set(new Date(d.getFullYear(), d.getMonth() + 1, 1));
  }

  goToToday(): void {
    this.viewDate.set(new Date(this.today.getFullYear(), this.today.getMonth(), 1));
  }

  selectColor(color: SelectionColor): void {
    this.selectedColor.set(color);
  }

  onDayMouseEnter(day: CalendarDay, event: MouseEvent): void {
    if (day.markings.length) {
      this.positionTooltip(day, event.currentTarget as HTMLElement);
    }
  }

  onDayMouseLeave(): void {
    this.tooltipDay.set(null);
  }

  onDayMouseDown(day: CalendarDay, event: MouseEvent): void {
    // Prevent text selection while pressing; the synthetic click still fires.
    event.preventDefault();
  }

  /**
   * On touch devices, touchstart fires before click.
   * A plain touch on a marked day arms a long-press timer for the tooltip.
   * A flag swallows the subsequent click when dismissing the tooltip or when
   * the long-press fires, so the selection flow doesn't start unintentionally.
   */
  onDayTouchStart(day: CalendarDay, event: TouchEvent): void {
    // A new touch begins: drop any stale swallow left by a previous touch whose
    // synthetic click never fired (e.g. the gesture became a scroll).
    this.pendingClickSwallow = false;

    if (this.tooltipDay()) {
      // Dismiss tooltip; swallow the click so we don't create a marking
      this.tooltipDay.set(null);
      this.pendingClickSwallow = true;
      return;
    }

    if (day.markings.length) {
      this.startLongPress(day, event.currentTarget as HTMLElement);
    }
  }

  private startLongPress(day: CalendarDay, el: HTMLElement): void {
    this.cancelLongPress();
    this.longPressTimer = window.setTimeout(() => {
      this.longPressTimer = null;
      this.positionTooltip(day, el);
      this.pendingClickSwallow = true;
    }, LONG_PRESS_MS);
  }

  cancelLongPress(): void {
    if (this.longPressTimer === null) return;
    window.clearTimeout(this.longPressTimer);
    this.longPressTimer = null;
  }

  onGridTouchStart(event: TouchEvent): void {
    const t = event.touches?.[0];
    if (!t) return;
    const anchorDate = this.cellAtPoint(t.clientX, t.clientY)?.dataset['date'] ?? null;
    this.swipeAnchor = anchorDate;
    this.swipeStartX = t.clientX;
    this.swipeStartY = t.clientY;
    this.swipeMoved = false;
    this.previewDays.set(anchorDate ? [anchorDate] : []);
  }

  onGridTouchMove(event: TouchEvent): void {
    this.cancelLongPress();

    if (this.swipeAnchor === null) return;
    const t = event.touches?.[0];
    if (!t) return;

    if (
      !this.swipeMoved &&
      Math.hypot(t.clientX - this.swipeStartX, t.clientY - this.swipeStartY) <= SWIPE_THRESHOLD_PX
    ) {
      return;
    }

    if (!this.swipeMoved) {
      this.swipeMoved = true;
      this.tooltipDay.set(null);
    }

    event.preventDefault();

    const iso = this.cellAtPoint(t.clientX, t.clientY)?.dataset['date'];
    if (iso) {
      this.addPreviewDay(iso);
    }
  }

  onGridTouchEnd(event: TouchEvent): void {
    this.cancelLongPress();
    if (this.swipeMoved) {
      this.pendingClickSwallow = true;
      this.commitPreviewDays();
    }
    this.swipeAnchor = null;
    this.swipeMoved = false;
    this.previewDays.set([]);
  }

  onGridTouchCancel(event: TouchEvent): void {
    this.cancelLongPress();
    this.swipeAnchor = null;
    this.swipeMoved = false;
    this.previewDays.set([]);
  }

  onGridMouseDown(event: MouseEvent): void {
    const anchorDate = this.cellAtPoint(event.clientX, event.clientY)?.dataset['date'] ?? null;
    this.pressAnchor = anchorDate;
    this.pressStartX = event.clientX;
    this.pressStartY = event.clientY;
    this.pressMoved = false;
    this.previewDays.set(anchorDate ? [anchorDate] : []);
    event.preventDefault();
  }

  onGridMouseMove(event: MouseEvent): void {
    if (this.pressAnchor === null) return;

    if (
      !this.pressMoved &&
      Math.hypot(event.clientX - this.pressStartX, event.clientY - this.pressStartY) <=
        SWIPE_THRESHOLD_PX
    ) {
      return;
    }

    this.pressMoved = true;

    const iso = this.cellAtPoint(event.clientX, event.clientY)?.dataset['date'];
    if (iso) {
      this.addPreviewDay(iso);
    }
  }

  onGridMouseUp(event: MouseEvent): void {
    if (this.pressMoved) {
      this.pendingClickSwallow = true;
      this.commitPreviewDays();
    }
    this.pressAnchor = null;
    this.pressMoved = false;
    this.previewDays.set([]);
  }

  onDayClick(day: CalendarDay): void {
    if (this.pendingClickSwallow) {
      this.pendingClickSwallow = false;
      return;
    }

    this.tooltipDay.set(null);
    this.paintDay(day, true);
  }

  private paintDay(day: CalendarDay, toggle: boolean): void {
    const user = this.currentUser();
    if (!user) return;

    const isoDate = toIsoDate(day.date);
    const color = this.selectedColor();
    const ownMarking = day.markings.find((m) => m.own);

    if (ownMarking && day.ownColor === color) {
      if (!toggle) return;
      this.removeMarking(ownMarking.periodId);
      return;
    }

    if (ownMarking && day.ownColor !== color) {
      // Different own color: chain delete → create so the server's per-user
      // overlap check never sees the old period still on the server.
      this.isSaving.set(true);
      this.errorMessage.set(null);
      this.periodService.deletePeriod(ownMarking.periodId).subscribe({
        next: () => {
          this.periods.update((list) => list.filter((p) => p.id !== ownMarking.periodId));
          this.createOneDayMarking(isoDate, color, user);
        },
        error: () => {
          this.isSaving.set(false);
        },
      });
      return;
    }

    this.createOneDayMarking(isoDate, color, user);
  }

  private createOneDayMarking(isoDate: string, color: SelectionColor, user: string): void {
    this.isSaving.set(true);
    this.errorMessage.set(null);
    this.periodService
      .createPeriod(this.eventId, { start: isoDate, end: isoDate, color, userName: user })
      .subscribe({
        next: (resp) => {
          this.periods.update((list) => [
            ...list,
            {
              id: resp.id,
              eventId: this.eventId,
              start: resp.start,
              end: resp.end,
              color: resp.color,
              userName: resp.userName,
            },
          ]);
          this.isSaving.set(false);
        },
        error: (err: HttpErrorResponse) => {
          this.isSaving.set(false);
          if (err.status === 409) {
            // The local list is stale (e.g. the same user marked this day in
            // another tab between the 15s polls) — resync instead of complaining.
            this.resyncPeriods();
          } else {
            // Network/server unavailable — store locally as fallback
            this.periods.update((list) => [
              ...list,
              {
                id: crypto.randomUUID(),
                eventId: this.eventId,
                start: isoDate,
                end: isoDate,
                color,
                userName: user,
              },
            ]);
          }
        },
      });
  }

  private resyncPeriods(): void {
    this.periodService.getPeriods(this.eventId).subscribe({
      next: (list) => this.periods.set(list),
      error: () => this.errorMessage.set(RESYNC_ERROR_MSG),
    });
  }

  clearError(): void {
    this.errorMessage.set(null);
  }

  logout(): void {
    this.authService.logout();
    this.currentUser.set(null);
  }

  private cellAtPoint(x: number, y: number): HTMLElement | null {
    if (typeof document === 'undefined' || typeof document.elementFromPoint !== 'function') {
      return null;
    }
    return (document.elementFromPoint(x, y) as Element | null)?.closest(
      '.day-cell',
    ) as HTMLElement | null;
  }

  private addPreviewDay(iso: string): void {
    const day = this.weeks()
      .flat()
      .find((d) => d.date.toISOString() === iso);
    if (!day) return;
    if (!this.previewDays().includes(iso)) {
      this.previewDays.update((list) => [...list, iso]);
    }
  }

  private commitPreviewDays(): void {
    // Fresh lookup per day: a repaint's delete→create mutates periods mid-loop,
    // so later days must see the updated markings.
    for (const iso of this.previewDays()) {
      const day = this.weeks()
        .flat()
        .find((d) => d.date.toISOString() === iso);
      if (day) this.paintDay(day, false);
    }
  }

  private positionTooltip(day: CalendarDay, el: HTMLElement): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const cellRect = el.getBoundingClientRect();
    const shellRect = (this.elementRef.nativeElement as HTMLElement).getBoundingClientRect();
    const half = 80; // keeps the tooltip (max-width 160px) inside the shell on narrow screens
    const x = cellRect.left - shellRect.left + cellRect.width / 2;
    const clampedX = Math.min(Math.max(x, half), Math.max(shellRect.width - half, half));
    const above = cellRect.top > window.innerHeight * 0.55;
    const y = above ? cellRect.top - shellRect.top : cellRect.bottom - shellRect.top;
    this.tooltipAbove.set(above);
    this.tooltipPos.set({ x: clampedX, y });
    this.tooltipDay.set(day);
  }

  private removeMarking(id: string): void {
    this.isSaving.set(true);
    this.periodService.deletePeriod(id).subscribe({
      next: () => {
        this.periods.update((list) => list.filter((p) => p.id !== id));
        this.isSaving.set(false);
      },
      error: () => {
        this.periods.update((list) => list.filter((p) => p.id !== id));
        this.isSaving.set(false);
      },
    });
  }

  private isSameDay(a: Date, b: Date): boolean {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  }
}

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatPlDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('pl-PL', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
