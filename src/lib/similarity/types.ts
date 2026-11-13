/** What we know about a project, in a shape that can be compared across projects. */
export interface ProjectProfile {
  /** Two or three sentences: what the project is and why it exists. */
  summary: string;
  /** Outcomes the project is trying to reach. */
  goals: string[];
  /** Themes and subject matter, lower case, normalised. */
  keywords: string[];
  /** Languages, frameworks, platforms, tools and standards, normalised. */
  technologies: string[];
  /** Business or subject domains, such as "events" or "e-commerce". */
  domains: string[];
  /** What the project hands over at the end. */
  deliverables: string[];
}

/** The raw material a profile is extracted from. */
export interface ProjectSource {
  name: string;
  description: string;
  tasks: { title: string; notes?: string | null }[];
  meetings: { title: string; summary?: string | null; decisions?: string[] }[];
}

export interface StoredProfile {
  projectId: string;
  profile: ProjectProfile;
  embedding: number[];
  embeddingModel: string;
  extractor: string;
  contentHash: string;
}

export interface SimilarityWeights {
  semantic: number;
  technologies: number;
  keywords: number;
  domains: number;
}

export interface SimilarityResult {
  projectId: string;
  /** 0 to 1. */
  score: number;
  parts: { semantic: number; technologies: number | null; keywords: number | null; domains: number | null };
  shared: { technologies: string[]; keywords: string[]; domains: string[] };
  /** One plain sentence built from the shared items. */
  reason: string;
}
