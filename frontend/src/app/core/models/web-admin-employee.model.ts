export interface WebAdminEmployeeResponse {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  org_name: string;
  status: 'FORCE_CHANGE_PASSWORD' | 'CONFIRMED' | 'DISABLED' | string;
  created_at: string;
  updated_at: string;
}
