import { createShiftCrudHandler } from '../../shared/handler-factories.js';
import * as service from './service.js';

export const handler = createShiftCrudHandler(service, 'manager shifts handler');
