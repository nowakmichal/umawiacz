import { Routes } from '@angular/router';
import { Calendar } from './calendar/calendar';
import { LoginComponent } from './login/login';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'calendar', pathMatch: 'full' },
  { path: 'calendar', component: Calendar, canActivate: [authGuard] },
  { path: 'login', component: LoginComponent },
];
