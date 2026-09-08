export interface EmployeeProfileResponse {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  manager_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateEmployeeProfileBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
}
