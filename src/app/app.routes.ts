import { Routes } from '@angular/router';
import { Calendar } from './calendar/calendar';

export const routes: Routes = [
  { path: '', redirectTo: 'calendar', pathMatch: 'full' },
  { path: 'calendar', component: Calendar },
];
