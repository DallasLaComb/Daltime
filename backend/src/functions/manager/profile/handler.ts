import { createProfileHandler } from '../../shared/handler-factories.js';
import * as service from './service.js';

// Pass 'Manager' so the factory rejects non-Manager callers with 403 before
// any DynamoDB lookup — prevents an Employee JWT from reaching a 404 code path.
export const handler = createProfileHandler(service, 'manager profile handler', 'Manager');
