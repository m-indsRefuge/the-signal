import { fail } from "./failures";
import { requireIdentity } from "./evaluation-contract";

const MUTABLE_REVISIONS = new Set(["main", "master", "latest", "head"]);

export function requireImmutableRevision(revision: string): string {
  requireIdentity(revision, "revision");
  if (MUTABLE_REVISIONS.has(revision.toLowerCase())) {
    fail("mutable_revision", "model revision must be immutable");
  }
  if (revision.includes("*") || revision.includes("..")) {
    fail("mutable_revision", "model revision must not be a range or wildcard");
  }
  return revision;
}

export function createModelIdentity(repositoryId: string, revision: string): string {
  requireIdentity(repositoryId, "repositoryId");
  requireImmutableRevision(revision);
  return `${repositoryId}@${revision}`;
}
