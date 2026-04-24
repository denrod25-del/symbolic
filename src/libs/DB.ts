import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '@/models/Schema';
import { Env } from './Env';

const globalWithDb = globalThis as typeof globalThis & {
  _dbPool?: Pool;
};

globalWithDb._dbPool ??= new Pool({ connectionString: Env.DATABASE_URL });

/** Shared Drizzle database instance. Single pool across Next.js hot-reloads. */
export const db = drizzle(globalWithDb._dbPool, { schema });
