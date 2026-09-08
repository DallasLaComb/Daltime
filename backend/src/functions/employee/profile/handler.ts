import { createProfileHandler } from '../../shared/handler-factories.js';
import * as service from './service.js';

// Pass 'Employee' so the factory rejects non-Employee callers with 403 before
// any DynamoDB lookup — prevents a Manager JWT from reaching a 404 code path.
export const handler = createProfileHandler(service, 'employee profile handler', 'Employee');
