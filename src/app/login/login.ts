import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginService } from '../services/login.service';
import { AuthService } from '../services/auth.service';
import { LoginRequest, LoginResponse } from '../models/login.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrl: './login.scss',
  imports: [FormsModule]
})
export class LoginComponent {
  username = '';
  errorMessage = signal<string | null>(null);

  constructor(
    private loginService: LoginService,
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    const username = this.username.trim().toLowerCase();
    if (!username) {
      this.errorMessage.set('Podaj nazwę użytkownika');
      return;
    }

    const request: LoginRequest = { username };

    this.loginService.login(request).subscribe({
      next: (response: LoginResponse) => {
        this.authService.login(response);
        this.router.navigate(['/events']);
      },
      error: (error: HttpErrorResponse) => {
        if (error.status === 400) {
          this.errorMessage.set('Podaj nazwę użytkownika');
        } else {
          this.errorMessage.set('Błąd logowania. Spróbuj ponownie.');
        }
      }
    });
  }
}