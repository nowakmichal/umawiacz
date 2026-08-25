import { Routes } from '@angular/router';
import { Calendar } from './calendar/calendar';
import { LoginComponent } from './login/login';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'events', pathMatch: 'full' },
  { path: 'calendar', redirectTo: 'events', pathMatch: 'full' },
  {
    path: 'events',
    loadComponent: () => import('./events/events').then((m) => m.EventList),
    canActivate: [authGuard],
  },
  { path: 'calendar/:eventId', component: Calendar },
  { path: 'login', component: LoginComponent },
];
