/**
 * TypeScript types for the web-admin profile feature.
 *
 * `WebAdminProfile` is the outward-facing response shape returned by GET and PUT
 * /web-admin/profile — it mirrors the DynamoDB `WebAdminMetadata` record with
 * the single-table key fields (PK, SK) stripped before sending to the caller.
 *
 * `UpdateProfileRequest` is the request body accepted by PUT /web-admin/profile.
 * Both fields are optional so callers can update only the field they want to
 * change, but at least one must be provided (enforced by the service layer).
 */
export interface WebAdminProfile {
  web_admin_id: string;
  sub: string;
  email: string;
  first_name: string;
  last_name: string;
  entity_type: 'WEB_ADMIN';
  status: string; // Cognito UserStatus after enrichment may differ from 'ACTIVE' | 'DISABLED'
  created_at: string;
  updated_at?: string; // May be absent on records created before updated_at was tracked
}

/**
 * Request body accepted by PUT /web-admin/profile.
 * At least one field must be a non-empty string — validated in service.ts.
 */
export interface UpdateProfileRequest {
  first_name?: string;
  last_name?: string;
}
