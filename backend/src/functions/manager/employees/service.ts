import {
  CognitoIdentityProviderClient,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  AdminGetUserCommand,
  UsernameExistsException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';
import type { Employee } from '../../shared/models/org-admin/employee.model.js';
import { stripKeys } from '../../shared/dynamo.js';
import type {
  EmployeeAvailability,
  EmployeeAvailabilityOverrides,
} from '../../shared/models/employee/availability.model.js';
import * as db from './db.js';

export class ValidationError extends Error {}
export class ConflictError extends Error {}
export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

const USER_POOL_ID = process.env['USER_POOL_ID']!;
const EMAIL_REGEX = /^[^\s@]+@[^\s@.]+\.[^\s@.]+$/;

interface CreateEmployeeBody {
  email: string;
  first_name: string;
  last_name: string;
  phone?: string;
  temp_password: string;
}

interface UpdateEmployeeBody {
  first_name?: string;
  last_name?: string;
  phone?: string;
}

async function resolveCallerManager(sub: string): Promise<{ org_id: string; manager_id: string }> {
  const lookup = await db.getCallerLookup(sub);
  if (!lookup) throw new ForbiddenError('Caller could not be resolved');
  return { org_id: lookup.org_id, manager_id: lookup.manager_id };
}

export async function listEmployees(
  callerSub: string,
  cognitoClient: CognitoIdentityProviderClient,
) {
  const { org_id, manager_id } = await resolveCallerManager(callerSub);
  const items = await db.listEmployeesByManager(org_id, manager_id);
  const employees = items.map(stripKeys);

  const withStatus = await Promise.all(
    employees.map(async (e) => {
      try {
        const user = await cognitoClient.send(
          new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: e.email }),
        );
        return { ...e, status: user.UserStatus ?? e.status };
      } catch {
        return e;
      }
    }),
  );

  return withStatus;
}

export async function createEmployee(
  callerSub: string,
  body: CreateEmployeeBody,
  cognitoClient: CognitoIdentityProviderClient,
) {
  if (!body.email?.trim()) throw new ValidationError('email is required');
  if (!EMAIL_REGEX.test(body.email.trim()))
    throw new ValidationError('email must be a valid email address');
  if (!body.first_name?.trim()) throw new ValidationError('first_name is required');
  if (!body.last_name?.trim()) throw new ValidationError('last_name is required');
  if (!body.temp_password?.trim()) throw new ValidationError('temp_password is required');

  const { org_id, manager_id } = await resolveCallerManager(callerSub);

  let employeeSub: string;
  try {
    const createResult = await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: body.email.trim(),
        TemporaryPassword: body.temp_password,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'name', Value: `${body.first_name.trim()} ${body.last_name.trim()}` },
          { Name: 'email', Value: body.email.trim() },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:org_id', Value: org_id },
        ],
      }),
    );
    employeeSub = createResult.User!.Attributes!.find((a) => a.Name === 'sub')!.Value!;
  } catch (err) {
    if (err instanceof UsernameExistsException) {
      throw new ConflictError('A user with this email already exists');
    }
    if (err instanceof InvalidPasswordException) {
      throw new ValidationError((err as Error).message);
    }
    throw err;
  }

  await cognitoClient.send(
    new AdminAddUserToGroupCommand({
      UserPoolId: USER_POOL_ID,
      Username: body.email.trim(),
      GroupName: 'Employee',
    }),
  );

  const now = new Date().toISOString();
  const employee: Employee = {
    PK: `ORG#${org_id}`,
    SK: `EMPLOYEE#${employeeSub}`,
    GSI1PK: 'EMPLOYEE',
    GSI1SK: now,
    employee_id: employeeSub,
    first_name: body.first_name.trim(),
    last_name: body.last_name.trim(),
    email: body.email.trim(),
    phone: body.phone?.trim() ?? '',
    org_id,
    manager_id,
    status: 'FORCE_CHANGE_PASSWORD',
    created_at: now,
    updated_at: now,
  };

  await db.createEmployee(employee);

  return stripKeys(employee);
}

export async function updateEmployee(
  callerSub: string,
  employeeId: string,
  body: UpdateEmployeeBody,
  _cognitoClient: CognitoIdentityProviderClient,
) {
  const hasFields =
    body.first_name !== undefined || body.last_name !== undefined || body.phone !== undefined;
  if (!hasFields) throw new ValidationError('At least one field must be provided');

  if (body.first_name !== undefined && !body.first_name.trim()) {
    throw new ValidationError('first_name cannot be empty');
  }
  if (body.last_name !== undefined && !body.last_name.trim()) {
    throw new ValidationError('last_name cannot be empty');
  }

  const { org_id, manager_id } = await resolveCallerManager(callerSub);

  const employee = await db.getEmployee(org_id, employeeId);
  if (!employee) throw new NotFoundError(`Employee '${employeeId}' not found`);
  if (employee.manager_id !== manager_id)
    throw new ForbiddenError('Not authorized to manage this employee');

  const fields: { first_name?: string; last_name?: string; phone?: string } = {};
  if (body.first_name !== undefined) fields.first_name = body.first_name.trim();
  if (body.last_name !== undefined) fields.last_name = body.last_name.trim();
  if (body.phone !== undefined) fields.phone = body.phone.trim();

  const updated = await db.updateEmployee(org_id, employeeId, fields, new Date().toISOString());
  return stripKeys(updated!);
}

export async function disableEmployee(
  callerSub: string,
  employeeId: string,
  cognitoClient: CognitoIdentityProviderClient,
) {
  const { org_id, manager_id } = await resolveCallerManager(callerSub);

  const employee = await db.getEmployee(org_id, employeeId);
  if (!employee) throw new NotFoundError(`Employee '${employeeId}' not found`);
  if (employee.manager_id !== manager_id)
    throw new ForbiddenError('Not authorized to manage this employee');

  await cognitoClient.send(
    new AdminDisableUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: employee.email,
    }),
  );

  await db.disableEmployee(org_id, employeeId);
}

export async function getEmployeeAvailabilityForManager(
  callerSub: string,
  employeeId: string,
): Promise<Record<string, unknown>> {
  const { org_id, manager_id } = await resolveCallerManager(callerSub);
  const employee = await db.getEmployee(org_id, employeeId);
  if (!employee) throw new NotFoundError(`Employee '${employeeId}' not found`);
  if (employee.manager_id !== manager_id) throw new ForbiddenError('Not authorized');
  const record = await db.getEmployeeAvailability(employeeId);
  if (!record) return { employee_id: employeeId, schedule: null, updated_at: null };
  return stripKeys(record as unknown as EmployeeAvailability);
}

export async function getEmployeeAvailabilityOverridesForManager(
  callerSub: string,
  employeeId: string,
): Promise<Record<string, unknown>> {
  const { org_id, manager_id } = await resolveCallerManager(callerSub);
  const employee = await db.getEmployee(org_id, employeeId);
  if (!employee) throw new NotFoundError(`Employee '${employeeId}' not found`);
  if (employee.manager_id !== manager_id) throw new ForbiddenError('Not authorized');
  const record = await db.getEmployeeAvailabilityOverrides(employeeId);
  if (!record) return { employee_id: employeeId, overrides: {}, updated_at: null };
  return stripKeys(record as unknown as EmployeeAvailabilityOverrides);
}

export async function enableEmployee(
  callerSub: string,
  employeeId: string,
  cognitoClient: CognitoIdentityProviderClient,
) {
  const { org_id, manager_id } = await resolveCallerManager(callerSub);

  const employee = await db.getEmployee(org_id, employeeId);
  if (!employee) throw new NotFoundError(`Employee '${employeeId}' not found`);
  if (employee.manager_id !== manager_id)
    throw new ForbiddenError('Not authorized to manage this employee');

  await cognitoClient.send(
    new AdminEnableUserCommand({
      UserPoolId: USER_POOL_ID,
      Username: employee.email,
    }),
  );

  await db.enableEmployee(org_id, employeeId);
}
