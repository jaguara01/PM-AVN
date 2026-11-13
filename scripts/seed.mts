/* Loads the example projects into an empty database and writes their profiles. Run with `npm run db:seed`. */
import { getDb } from '@/lib/db/client';
import { loadExamples } from '@/lib/examples';
import { refreshAllProfiles } from '@/lib/services/profiles';

const db = await getDb();
const added = await loadExamples(db);
console.log(added ? `Added ${added} example projects.` : 'The database already has projects; nothing added.');
const r = await refreshAllProfiles(db);
console.log(`Profiles: ${r.changed} written, ${r.total - r.changed} already up to date.`);
await db.close();
