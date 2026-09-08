/**
 * A user–location assignment record stored in DynamoDB.
 *
 * One record per assignment:
 *   PK  = USER#<userId>
 *   SK  = LOCATION#<locationId>
 *
 * Query all locations for a user:
 *   PK = USER#<userId>  AND  begins_with(SK, 'LOCATION#')
 */
export interface UserLocation {
  PK: string;
  SK: string;
  user_id: string;
  user_type: 'MANAGER' | 'EMPLOYEE';
  location_id: string;
  location_name: string; // denormalized for cheap reads
  org_id: string;
  assigned_by: string; // OrgAdmin user_id
  assigned_at: string; // ISO 8601
}

/** Body accepted on POST /org-admin/managers/{managerId}/locations */
export interface AssignUserLocationBody {
  location_id: string;
}
