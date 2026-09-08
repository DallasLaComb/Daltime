export interface WebAdminEmployee {
  PK: string;
  SK: string;
  GSI1PK?: string;
  GSI1SK?: string;
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface WebAdminEmployeeResponse {
  employee_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  org_id: string;
  org_name: string;
  status: string;
  created_at: string;
  updated_at: string;
}
