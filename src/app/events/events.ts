import { Component, OnInit, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { CreateEventRequest, Event } from '../models/event.model';
import { EventService } from '../services/event.service';

@Component({
  selector: 'app-events',
  imports: [FormsModule],
  templateUrl: './events.html',
  styleUrl: './events.scss',
})
export class EventList implements OnInit {
  private readonly eventService = inject(EventService);
  private readonly router = inject(Router);

  readonly events = signal<Event[]>([]);
  readonly isLoading = signal(true);
  readonly loadError = signal<string | null>(null);

  readonly isCreating = signal(false);
  readonly createError = signal<string | null>(null);
  readonly copiedId = signal<string | null>(null);

  name = '';
  startDate = '';
  endDate = '';
  description = '';

  ngOnInit(): void {
    this.loadEvents();
  }

  loadEvents(): void {
    this.isLoading.set(true);
    this.loadError.set(null);
    this.eventService.getEvents().subscribe({
      next: (events) => {
        this.events.set(events);
        this.isLoading.set(false);
      },
      error: () => {
        this.loadError.set('Nie udało się pobrać listy wydarzeń.');
        this.isLoading.set(false);
      },
    });
  }

  openEvent(id: string): void {
    this.router.navigate(['/calendar', id]);
  }

  copyLink(id: string): void {
    const url = `${window.location.origin}/calendar/${id}`;
    navigator.clipboard?.writeText(url).catch(() => {});
    this.copiedId.set(id);
    setTimeout(() => {
      if (this.copiedId() === id) this.copiedId.set(null);
    }, 2000);
  }

  create(): void {
    const name = this.name.trim();
    if (!name || !this.startDate || !this.endDate) {
      this.createError.set('Wypełnij nazwę, datę początkową i końcową.');
      return;
    }
    if (this.startDate > this.endDate) {
      this.createError.set('Data początkowa nie może być późniejsza niż końcowa.');
      return;
    }

    const req: CreateEventRequest = {
      name,
      startDate: this.startDate,
      endDate: this.endDate,
    };
    const description = this.description.trim();
    if (description) req.description = description;

    this.isCreating.set(true);
    this.createError.set(null);
    this.eventService.createEvent(req).subscribe({
      next: (event) => {
        this.events.update((list) =>
          [...list, event].sort((a, b) => a.startDate.localeCompare(b.startDate)),
        );
        this.name = '';
        this.startDate = '';
        this.endDate = '';
        this.description = '';
        this.isCreating.set(false);
      },
      error: (err: HttpErrorResponse) => {
        const body = err.error as { error?: string } | null;
        this.createError.set(
          body?.error ?? 'Nie udało się utworzyć wydarzenia. Spróbuj ponownie.',
        );
        this.isCreating.set(false);
      },
    });
  }

  dateLabel(evt: Event): string {
    const start = this.formatDate(evt.startDate);
    const end = this.formatDate(evt.endDate);
    if (start === end) return start;
    return `${start} – ${end}`;
  }

  private formatDate(dateStr: string): string {
    const [y, m, d] = dateStr.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('pl-PL', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }
}
