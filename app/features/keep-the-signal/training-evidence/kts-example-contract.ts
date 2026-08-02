import type {
  JsonObject,
  JsonValue,
} from "../../intelligence-harness/memory-fabric/canonical-json";
export const KTS_TRAINING_TASKS = Object.freeze([
  "proposal_schema_compliance",
  "legal_proposal_classification",
  "grounded_tactical_proposal",
  "uncertainty_safe_abstention",
  "deterministic_strategy_selection",
  "proposal_preference",
  "proposal_correction",
  "outcome_sensitive_comparison",
] as const);
export type KtsTrainingTask = (typeof KTS_TRAINING_TASKS)[number];
export interface KtsTrainingSource {
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly seed: string;
  readonly encounterId: string;
  readonly episodeFamilyId: string;
  readonly engineVersion: string;
  readonly rulesetVersion: string;
  readonly observationSchemaId: string;
  readonly observationSchemaVersion: number;
  readonly proposalSchemaId: string;
  readonly proposalSchemaVersion: number;
  readonly strategyId?: string;
  readonly strategyVersion?: string;
  readonly adviserClassification: string;
  readonly proposalValidation: string;
  readonly observation: JsonObject;
  readonly proposal?: JsonValue;
  readonly abstentionCode?: string;
  readonly evidenceReferences: readonly string[];
  readonly contradictionReferences: readonly string[];
  readonly outcomeMetrics?: JsonObject;
  readonly accepted: boolean;
  readonly correctedProposal?: JsonValue;
  readonly reviewerStatus: "accepted" | "rejected" | "unknown";
}
