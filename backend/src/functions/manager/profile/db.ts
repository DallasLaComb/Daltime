import {
  getMetadataRecord,
  updateOrgAndMetadataRecord,
  getOrgEntityRecord,
} from '../../shared/dynamo.js';
import type { Manager } from '../../shared/models/org-admin/manager.model.js';

export async function getCallerLookup(managerId: string): Promise<{ org_id: string } | null> {
  return getMetadataRecord(managerId);
}

export async function getRecord(orgId: string, managerId: string): Promise<Manager | null> {
  return getOrgEntityRecord<Manager>(orgId, 'MANAGER', managerId);
}

export async function updateRecord(
  orgId: string,
  managerId: string,
  fields: { first_name?: string; last_name?: string; phone?: string },
  updatedAt: string,
): Promise<Manager | null> {
  return updateOrgAndMetadataRecord<Manager>(
    { PK: `ORG#${orgId}`, SK: `MANAGER#${managerId}` },
    managerId,
    fields,
    updatedAt,
  );
}
