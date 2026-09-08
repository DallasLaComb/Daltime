export interface EmployeeResponse {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  manager_id: string;
  status: 'FORCE_CHANGE_PASSWORD' | 'CONFIRMED' | 'DISABLED' | string;
  created_at: string;
  updated_at: string;
}

export interface CreateEmployeeBody {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  temp_password: string;
  manager_id?: string;
}

export interface UpdateEmployeeBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
  manager_id?: string;
}
