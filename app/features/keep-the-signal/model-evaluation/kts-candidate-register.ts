export const KTS_INITIAL_CANDIDATE_FAMILIES = Object.freeze([
  "Qwen/Qwen3-0.6B",
  "Qwen/Qwen3-1.7B",
  "HuggingFaceTB/SmolLM3-3B",
  "google/gemma-3-1b-it",
] as const);

export function isInitialKtsCandidate(repositoryId: string): boolean {
  return (KTS_INITIAL_CANDIDATE_FAMILIES as readonly string[]).includes(repositoryId);
}
