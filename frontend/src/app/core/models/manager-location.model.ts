export interface ManagerLocation {
  location_id: string;
  org_id: string;
  name: string;
  address?: string;
  created_by: string;
  created_at: string;
  updated_at?: string;
}

export interface CreateLocationBody {
  name: string;
  address?: string;
}

export interface UpdateLocationBody {
  name?: string;
  address?: string;
}
