export interface OrgAdminProfileResponse {
  user_id: string;
  email: string;
  name: string;
  org_id: string;
  status: string;
  created_at: string;
}

export interface UpdateOrgAdminProfileBody {
  name: string;
}
