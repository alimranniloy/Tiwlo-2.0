import { queryPg } from '../server/db/postgres.js';
import routes from './routes.js';
import { PICK_SCHEMA_SQL } from './schema.js';
import { startPickPaymentExpiry } from './payments.js';

export async function initializePickSchema() {
  await queryPg(PICK_SCHEMA_SQL);
  startPickPaymentExpiry();
}

export default routes;
