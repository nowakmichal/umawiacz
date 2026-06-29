import { Component, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LoginService } from '../services/login.service';
import { AuthService } from '../services/auth.service';
import { LoginRequest, LoginResponse } from '../models/login.model';

@Component({
  selector: 'app-login',
  templateUrl: './login.html',
  styleUrls: ['./login.scss'],
  imports: [FormsModule]
})
export class LoginComponent {
  username = '';
  password = '';
  errorMessage = signal<string | null>(null);

  constructor(
    private loginService: LoginService,
    private authService: AuthService,
    private router: Router
  ) {}

  onSubmit() {
    const request: LoginRequest = {
      username: this.username,
      password: this.password
    };

    this.loginService.login(request).subscribe({
      next: (response: LoginResponse) => {
        if (response.success) {
          // Store user in auth service
          this.authService.login(response);
          
          // Redirect to calendar page
          this.router.navigate(['/calendar']);
        } else {
          this.errorMessage.set('Nieprawidłowa nazwa użytkownika lub hasło');
        }
      },
      error: (error) => {
        this.errorMessage.set('Błąd logowania. Spróbuj ponownie.');
      }
    });
  }
}