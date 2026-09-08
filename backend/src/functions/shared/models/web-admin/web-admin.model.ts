/**
 * WebAdmin reverse-lookup record stored in DynamoDB.
 *
 * One record exists per provisioned WebAdmin Cognito user.
 * There is no "primary" record scoped to an org — WebAdmins are cross-org
 * and are identified solely by their Cognito sub.
 *
 * Single-table key layout:
 *   PK          = USER#<sub>   (Cognito sub)
 *   SK          = METADATA
 *   GSI1PK      = (absent — no GSI1 entry; no cross-WebAdmin list pattern exists)
 *   GSI1SK      = (absent)
 *
 * Purpose of this record:
 *   1. Fail-closed gate: if the record is missing the request is rejected 403.
 *   2. Audit stamping: `web_admin_id` is threaded into every mutating service
 *      function and written as `modified_by_web_admin_id` on affected items.
 *
 * No GSI is needed:
 *   - The only required read is a point lookup by Cognito sub (GetItem on
 *     PK = USER#<sub>, SK = METADATA), served by the base table.
 *   - There is no in-app "list all WebAdmins" query — cross-tenant WebAdmin
 *     enumeration belongs at the AWS/IAM layer for human operators, not in
 *     the application query layer.
 */
export interface WebAdminMetadata {
  PK: string; // USER#<sub>
  SK: 'METADATA';
  web_admin_id: string; // WADMIN#<uuid> — stable audit identifier
  sub: string; // Cognito sub (mirrors PK suffix for convenience)
  email: string;
  first_name: string;
  last_name: string;
  entity_type: 'WEB_ADMIN';
  status: 'ACTIVE' | 'DISABLED';
  created_at: string; // ISO 8601
}

/**
 * The minimal shape returned to callers of getWebAdminLookup — only the
 * fields that auth and service layers need at runtime. Callers should not
 * expose the full DynamoDB item to handler or service code.
 *
 * `status` is included so `requireWebAdminWithLookup` can reject DISABLED
 * callers with a 403 without needing to re-fetch the full record.
 */
export interface WebAdminCaller {
  sub: string;
  web_admin_id: string;
  email: string;
  status: 'ACTIVE' | 'DISABLED';
}
