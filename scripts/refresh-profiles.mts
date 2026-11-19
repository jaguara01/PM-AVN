/* Rewrites project profiles. `npm run profiles` updates what changed; `npm run profiles -- --force` redoes all,
   which is what you want after switching the Claude model or the embedding model. */
import './env.mts';
import { getDb } from '@/lib/db/client';
import { refreshAllProfiles } from '@/lib/services/profiles';

const db = await getDb();
const r = await refreshAllProfiles(db, {}, process.argv.includes('--force'));
console.log(`Profiles: ${r.changed} written, ${r.total - r.changed} already up to date.`);
await db.close();
