import type { TickFrame } from "./actions";
import type { EngineEvent } from "./events";
import { createStateDigest, serializeCanonicalState, stepGame } from "./game-engine";
import { createInitialGameState, type GameState } from "./game-state";

export interface RunSimulationOptions {
  readonly seed: number;
  readonly frames: readonly Readonly<TickFrame>[];
  readonly maximumTickCount?: number;
}

export interface SimulationResult {
  readonly processedTicks: number;
  readonly finalState: GameState;
  readonly events: EngineEvent[];
  readonly canonicalState: string;
  readonly stateDigest: string;
}

export function runSimulation(options: Readonly<RunSimulationOptions>): SimulationResult {
  const maximumTickCount = options.maximumTickCount ?? options.frames.length;

  if (!Number.isSafeInteger(maximumTickCount) || maximumTickCount < 0) {
    throw new RangeError("maximumTickCount must be a non-negative safe integer.");
  }

  let state = createInitialGameState({
    seed: options.seed,
  });

  const events: EngineEvent[] = [];
  let processedTicks = 0;

  for (const frame of options.frames) {
    if (state.status === "terminal" || processedTicks >= maximumTickCount) {
      break;
    }

    const result = stepGame(state, frame);

    state = result.state;
    events.push(...result.events);
    processedTicks += 1;
  }

  const canonicalState = serializeCanonicalState(state);

  return {
    processedTicks,
    finalState: state,
    events,
    canonicalState,
    stateDigest: createStateDigest(state),
  };
}
