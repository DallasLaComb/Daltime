/**
 * Response shape returned by GET /web-admin/profile and PUT /web-admin/profile.
 * Mirrors the WebAdminProfile type defined in backend/src/functions/web-admin/profile/model.ts.
 * The `status` field reflects the live Cognito UserStatus (e.g. CONFIRMED),
 * not the DynamoDB ACTIVE/DISABLED value.
 */
export interface WebAdminProfileResponse {
  web_admin_id: string;
  sub: string;
  email: string;
  first_name: string;
  last_name: string;
  entity_type: string;
  status: string;
  created_at: string;
  updated_at?: string;
}

/**
 * Request body for PUT /web-admin/profile.
 * At least one field must be provided; empty strings are rejected by the backend.
 */
export interface UpdateWebAdminProfileBody {
  first_name?: string;
  last_name?: string;
}
