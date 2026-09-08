import {
  getMetadataRecord,
  updateOrgAndMetadataRecord,
  getOrgEntityRecord,
} from '../../shared/dynamo.js';
import type { Employee } from '../../shared/models/org-admin/employee.model.js';

export async function getCallerLookup(
  employeeId: string,
): Promise<{ org_id: string; employee_id: string } | null> {
  return getMetadataRecord(employeeId);
}

export async function getRecord(orgId: string, employeeId: string): Promise<Employee | null> {
  return getOrgEntityRecord<Employee>(orgId, 'EMPLOYEE', employeeId);
}

export async function updateRecord(
  orgId: string,
  employeeId: string,
  fields: { first_name?: string; last_name?: string; phone?: string },
  updatedAt: string,
): Promise<Employee | null> {
  return updateOrgAndMetadataRecord<Employee>(
    { PK: `ORG#${orgId}`, SK: `EMPLOYEE#${employeeId}` },
    employeeId,
    fields,
    updatedAt,
  );
}
