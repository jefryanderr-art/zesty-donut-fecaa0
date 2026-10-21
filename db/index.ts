import { drizzle } from 'drizzle-orm/netlify-db';
import { getDatabase } from '@netlify/database';
import * as schema from './schema.ts';

// Let Netlify select the runtime driver and configure its transaction pool.
export const database = getDatabase();
export const db = drizzle({ client: database, schema });
