export type LeakageResultState = "clear" | "blocked" | "unknown";

export type LeakageFinding = Readonly<{
  code: string;
  leftSampleId: string;
  rightSampleId: string;
}>;

export type LeakageResult = Readonly<{
  state: LeakageResultState;
  findings: readonly LeakageFinding[];
  policyId: string;
  policyVersion: string;
  digest: string;
}>;
