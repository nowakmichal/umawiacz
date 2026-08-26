export interface User {
  id: string;
  name: string;
}

export interface LoginRequest {
  username: string;
}

export interface LoginResponse {
  id: string;
  username: string;
  success: boolean;
}
