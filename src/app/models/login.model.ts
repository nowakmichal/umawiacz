export interface LoginRequest {
  username: string;
}

export interface LoginResponse {
  id: string;
  username: string;
  success: boolean;
}
