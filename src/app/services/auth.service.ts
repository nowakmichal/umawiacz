import { Injectable, signal } from '@angular/core';
import { LoginResponse } from '../models/login.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private _currentUser = signal<LoginResponse | null>(null);
  
  get currentUser() {
    return this._currentUser.asReadonly();
  }

  login(response: LoginResponse): void {
    this._currentUser.set({ ...response, username: response.username.trim().toLowerCase() });
  }

  logout(): void {
    this._currentUser.set(null);
  }

  isAuthenticated(): boolean {
    return this._currentUser() !== null;
  }
}