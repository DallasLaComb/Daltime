export interface UpdateManagerProfileBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

export interface ManagerProfileResponse {
  manager_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  org_admin_id: string;
  status: 'FORCE_CHANGE_PASSWORD' | 'CONFIRMED' | 'DISABLED';
  employee_count: number;
  created_at: string;
  updated_at: string;
}
