export interface UserLocationResponse {
  user_id: string;
  user_type: 'MANAGER' | 'EMPLOYEE';
  location_id: string;
  location_name: string;
  org_id: string;
  assigned_by: string;
  assigned_at: string;
}
