import { createProfileHandler } from '../../shared/handler-factories.js';
import * as service from './service.js';

export const handler = createProfileHandler(service, 'manager profile handler');
