// Types for authentication and registration
export interface RegisterRequest {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  companyId: string;
}

export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

export interface User {
  userid: string;
  companyid: string;
  firstname: string;
  lastname: string;
  phonenumber: number;
  email: string;
  role: string;
}

export interface RegisterResponse {
  user: User;
}
