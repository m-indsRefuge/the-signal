import {
  ABSENT_EVALUATION_AUTHORITY,
  digestCanonical,
  immutableCopy,
  requireIdentity,
  requireIsoTime,
} from "./evaluation-contract";

export type InvocationRequest = Readonly<{
  invocationId: string;
  suiteId: string;
  suiteDigest: string;
  caseId: string;
  caseDigest: string;
  hardwareSnapshotId: string;
  hardwareSnapshotDigest: string;
  candidateIdentity: string;
  candidateDigest: string;
  artifactId: string;
  artifactDigest: string;
  runtimeId: string;
  runtimeDigest: string;
  promptId: string;
  promptDigest: string;
  generationProfileId: string;
  generationProfileDigest: string;
  responseProtocolId: string;
  startDeadline: string;
  cancellationId: string;
  invocationAuthorizationId: string;
  authority: typeof ABSENT_EVALUATION_AUTHORITY;
  requestDigest: string;
}>;

export function createInvocationRequest(
  input: Omit<InvocationRequest, "authority" | "requestDigest">,
): InvocationRequest {
  for (const [label, value] of Object.entries(input)) {
    if (typeof value === "string" && label !== "startDeadline") {
      requireIdentity(value, label);
    }
  }
  requireIsoTime(input.startDeadline, "startDeadline");
  const core = { ...input, authority: ABSENT_EVALUATION_AUTHORITY };
  return immutableCopy({
    ...core,
    requestDigest: digestCanonical(core),
  }) as InvocationRequest;
}
