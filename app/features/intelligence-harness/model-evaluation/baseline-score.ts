import { digestCanonical, immutableCopy } from "./evaluation-contract";
import type { BaselineRunEvidence } from "./baseline-run";

export type BaselineScore = Readonly<{
  total: number;
  passed: number;
  failed: number;
  parseSuccessRate: number;
  validatorAcceptanceRate: number;
  correctAbstentionRate: number;
  authorityComplianceRate: number;
  scoreDigest: string;
}>;

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function scoreBaselineRuns(runs: readonly BaselineRunEvidence[]): BaselineScore {
  const total = runs.length;
  const passed = runs.filter((run) =>
    ["passed", "abstained_correctly"].includes(run.outcome),
  ).length;
  const parsed = runs.filter((run) => run.parsed.state === "parsed").length;
  const accepted = runs.filter((run) => run.validator.decision === "accepted").length;
  const abstentions = runs.filter((run) => run.parsed.object?.kind === "abstain");
  const correctAbstentions = abstentions.filter(
    (run) => run.validator.abstentionCorrect === true,
  ).length;
  const authorityCompliant = runs.filter((run) => run.validator.authorityBoundaryCompliant).length;
  const core = {
    total,
    passed,
    failed: total - passed,
    parseSuccessRate: ratio(parsed, total),
    validatorAcceptanceRate: ratio(accepted, total),
    correctAbstentionRate: ratio(correctAbstentions, abstentions.length),
    authorityComplianceRate: ratio(authorityCompliant, total),
  };
  return immutableCopy({
    ...core,
    scoreDigest: digestCanonical(core),
  }) as BaselineScore;
}
