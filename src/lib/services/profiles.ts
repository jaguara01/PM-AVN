import type { Db } from '@/lib/db/client';
import { getProfile, getProjectSource, listProfiles, listProjects, upsertProfile } from '@/lib/db/repo';
import {
  buildSourceText, contentHash, embedderFromEnv, extractProfileOffline, extractProfileWithModel, profileToEmbeddingText, rankSimilar, topPairs,
  type CompleteFn, type Embedder, type SimilarityResult, type StoredProfile,
} from '@/lib/similarity';
import { claudeFromEnv, claudeModel } from '@/lib/llm';

export interface ProfileDeps {
  embedder?: Embedder;
  /** Pass null to force the offline extractor. */
  complete?: CompleteFn | null;
  extractorName?: string;
}

function resolve(deps: ProfileDeps) {
  const complete = deps.complete === undefined ? claudeFromEnv() : deps.complete;
  return { embedder: deps.embedder ?? embedderFromEnv(), complete, extractor: complete ? (deps.extractorName ?? claudeModel()) : 'offline' };
}

/**
 * Write or refresh one project's profile. Skips the work when nothing the profile is built from has changed
 * and the same extractor and embedding model are still in use, unless `force` is set.
 */
export async function refreshProfile(db: Db, projectId: string, deps: ProfileDeps = {}, force = false): Promise<{ profile: StoredProfile; changed: boolean }> {
  const { embedder, complete, extractor } = resolve(deps);
  const source = await getProjectSource(db, projectId);
  if (!source) throw new Error(`Project ${projectId} does not exist.`);
  const text = buildSourceText(source);
  const hash = contentHash(text);
  const existing = await getProfile(db, projectId);
  if (!force && existing && existing.contentHash === hash && existing.embeddingModel === embedder.model && existing.extractor === extractor) return { profile: existing, changed: false };

  let profile = extractProfileOffline(text, source.description);
  let usedExtractor = 'offline';
  if (complete) {
    try {
      profile = await extractProfileWithModel(text, complete);
      usedExtractor = extractor;
    } catch (err) {
      console.warn(`Profile extraction with ${extractor} failed for ${projectId}; using the offline extractor.`, err);
    }
  }
  const [embedding] = await embedder.embed([profileToEmbeddingText(source.name, profile)]);
  const stored: StoredProfile = { projectId, profile, embedding, embeddingModel: embedder.model, extractor: usedExtractor, contentHash: hash };
  await upsertProfile(db, stored);
  return { profile: stored, changed: true };
}

export async function refreshAllProfiles(db: Db, deps: ProfileDeps = {}, force = false): Promise<{ total: number; changed: number }> {
  const projects = await listProjects(db);
  let changed = 0;
  for (const p of projects) if ((await refreshProfile(db, p.id, deps, force)).changed) changed++;
  return { total: projects.length, changed };
}

/** Other projects ranked by the hybrid score. Only profiles embedded with the same model are compared. */
export async function similarProjects(db: Db, projectId: string, limit = 5): Promise<SimilarityResult[]> {
  const target = await getProfile(db, projectId);
  if (!target) return [];
  const all = await listProfiles(db, target.embeddingModel);
  return rankSimilar(target, all).slice(0, limit);
}

export async function strongestPairs(db: Db, limit = 8) {
  const all = await listProfiles(db, embedderFromEnv().model);
  return topPairs(all, limit);
}
