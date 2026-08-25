import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of, throwError } from 'rxjs';
import { HttpErrorResponse } from '@angular/common/http';
import { LoginComponent } from './login';
import { LoginService } from '../services/login.service';
import { AuthService } from '../services/auth.service';

function createLoginServiceMock() {
  return {
    login: vi.fn(),
  };
}

type MockLoginService = ReturnType<typeof createLoginServiceMock>;

describe('LoginComponent', () => {
  let fixture: ComponentFixture<LoginComponent>;
  let component: LoginComponent;
  let loginService: MockLoginService;
  let authService: AuthService;
  let navigate: ReturnType<typeof vi.fn>;

  beforeEach(async () => {
    vi.clearAllMocks();

    loginService = createLoginServiceMock();
    navigate = vi.fn().mockReturnValue(true);

    await TestBed.configureTestingModule({
      imports: [LoginComponent],
      providers: [
        { provide: LoginService, useValue: loginService },
        { provide: Router, useValue: { navigate } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LoginComponent);
    component = fixture.componentInstance;
    authService = TestBed.inject(AuthService);
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should send only the normalized username (no password)', () => {
    component.username = '  Test ';
    loginService.login.mockReturnValue(of({ username: 'test', success: true }));

    component.onSubmit();

    expect(loginService.login).toHaveBeenCalledWith({ username: 'test' });
  });

  it('should log the user in and redirect to events on success', () => {
    component.username = 'ala';
    loginService.login.mockReturnValue(of({ username: 'ala', success: true }));

    component.onSubmit();

    expect(authService.isAuthenticated()).toBe(true);
    expect(authService.currentUser()?.username).toBe('ala');
    expect(navigate).toHaveBeenCalledWith(['/events']);
  });

  it('should not submit an empty username', () => {
    component.username = '   ';

    component.onSubmit();

    expect(loginService.login).not.toHaveBeenCalled();
    expect(component.errorMessage()).toBe('Podaj nazwę użytkownika');
  });

  it('should show the required-field error on 400', () => {
    component.username = 'ala';
    loginService.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 400 })));

    component.onSubmit();

    expect(component.errorMessage()).toBe('Podaj nazwę użytkownika');
  });

  it('should show a generic error on other failures', () => {
    component.username = 'ala';
    loginService.login.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    component.onSubmit();

    expect(component.errorMessage()).toBe('Błąd logowania. Spróbuj ponownie.');
  });
});
