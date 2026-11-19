/* Loads .env.local (and .env) the same way `next dev` does, so scripts use the same keys and database as the app.
   Import this first in every script. */
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd());
