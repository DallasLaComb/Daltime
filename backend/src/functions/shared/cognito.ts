import {
  CognitoIdentityProviderClient,
  AdminGetUserCommand,
  AdminCreateUserCommand,
  AdminAddUserToGroupCommand,
  AdminDisableUserCommand,
  AdminEnableUserCommand,
  UsernameExistsException,
  InvalidPasswordException,
} from '@aws-sdk/client-cognito-identity-provider';
import { ConflictError, ValidationError } from './errors.js';

const USER_POOL_ID = process.env['USER_POOL_ID']!;

/**
 * For each item, attempt to fetch the current Cognito UserStatus and merge it into the record.
 * On any Cognito error the original item is returned unchanged.
 */
export async function enrichWithCognitoStatus<T extends { email: string; status: string }>(
  items: T[],
  cognitoClient: CognitoIdentityProviderClient,
): Promise<T[]> {
  return Promise.all(
    items.map(async (item) => {
      try {
        const user = await cognitoClient.send(
          new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: item.email }),
        );
        return { ...item, status: user.UserStatus ?? item.status };
      } catch {
        return item;
      }
    }),
  );
}

/**
 * Create a Cognito user for an employee, add them to the Employee group, and return their sub.
 * Throws ConflictError on duplicate email, ValidationError on bad password.
 */
export async function createCognitoEmployee(
  cognitoClient: CognitoIdentityProviderClient,
  email: string,
  firstName: string,
  lastName: string,
  tempPassword: string,
  orgId: string,
): Promise<string> {
  let employeeSub: string;
  try {
    const createResult = await cognitoClient.send(
      new AdminCreateUserCommand({
        UserPoolId: USER_POOL_ID,
        Username: email,
        TemporaryPassword: tempPassword,
        MessageAction: 'SUPPRESS',
        UserAttributes: [
          { Name: 'name', Value: `${firstName} ${lastName}` },
          { Name: 'email', Value: email },
          { Name: 'email_verified', Value: 'true' },
          { Name: 'custom:org_id', Value: orgId },
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
      Username: email,
      GroupName: 'Employee',
    }),
  );

  return employeeSub;
}

/**
 * Disable a Cognito user by email.
 */
export async function adminDisableUser(
  cognitoClient: CognitoIdentityProviderClient,
  email: string,
): Promise<void> {
  await cognitoClient.send(
    new AdminDisableUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
  );
}

/**
 * Enable (re-activate) a Cognito user by email.
 */
export async function adminEnableUser(
  cognitoClient: CognitoIdentityProviderClient,
  email: string,
): Promise<void> {
  await cognitoClient.send(
    new AdminEnableUserCommand({ UserPoolId: USER_POOL_ID, Username: email }),
  );
}

/**
 * Fetch a single item's Cognito UserStatus and merge it into the record.
 * On any Cognito error the original item is returned unchanged.
 */
export async function enrichSingleWithCognitoStatus<T extends { email: string; status: string }>(
  item: T,
  cognitoClient: CognitoIdentityProviderClient,
): Promise<T> {
  try {
    const user = await cognitoClient.send(
      new AdminGetUserCommand({ UserPoolId: USER_POOL_ID, Username: item.email }),
    );
    return { ...item, status: user.UserStatus ?? item.status };
  } catch {
    return item;
  }
}
