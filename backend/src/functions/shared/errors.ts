import type { APIGatewayProxyResultV2 } from 'aws-lambda';
import { badRequest, conflict, notFound, forbidden, internalError } from './response.js';

export class ValidationError extends Error {}
export class ConflictError extends Error {}
export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}

export function mapHandlerError(err: unknown, context: string): APIGatewayProxyResultV2 {
  if (err instanceof ValidationError) return badRequest(err.message);
  if (err instanceof ConflictError) return conflict(err.message);
  if (err instanceof NotFoundError) return notFound(err.message);
  if (err instanceof ForbiddenError) return forbidden(err.message);
  console.error(`Unhandled error in ${context}:`, err);
  return internalError('An unexpected error occurred');
}
