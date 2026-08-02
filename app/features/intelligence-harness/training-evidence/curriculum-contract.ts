import type { ExampleKind } from "./training-example-contract";
export const CURRICULUM_STAGES = Object.freeze([
  "schema_compliance",
  "legal_proposals",
  "grounded_proposals",
  "abstention_and_uncertainty",
  "strategy_routing",
  "correction_and_failure_recovery",
  "outcome_sensitive_advice",
  "mixed_difficulty",
] as const);
export type CurriculumStage = (typeof CURRICULUM_STAGES)[number];
export interface CurriculumStagePlan {
  readonly stage: CurriculumStage;
  readonly exampleKinds: readonly ExampleKind[];
  readonly maximumPerLineageFamily: number;
  readonly samplingBasisPoints: number;
  readonly requireProtectedReview: boolean;
  readonly validationCheckpoint: boolean;
}
export interface CurriculumPlan {
  readonly planId: string;
  readonly planVersion: string;
  readonly stages: readonly CurriculumStagePlan[];
  readonly knownRisks: readonly string[];
  readonly planDigest: string;
}
export interface SamplingDecision {
  readonly exampleId: string;
  readonly included: boolean;
  readonly stage: CurriculumStage;
  readonly reason: string;
  readonly decisionDigest: string;
}
