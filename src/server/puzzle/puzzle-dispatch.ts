import { randomUUID } from "crypto";
import { processDispatch } from "@/server/engine/dispatch-listener";
import type { EngineContext, PendingResolution } from "@/server/engine/pending-resolution";
import type { GameDispatch, DispatchResponse } from "@/lib/engine/message-types";
import type { DispatchType, DispatchData } from "@/lib/engine/message-types";

/**
 * Global worst-case auto-responses for Player 2 in puzzle mode.
 *
 * Maps defeated card IDs to the option string P2 should always pick.
 * Add entries here as new cards with when-defeated choices appear in puzzles.
 */
const PUZZLE_AUTO_RESPONSES: Record<string, string> = {
  "SOR_145": "deal_base_damage=1,3", // K-2SO: deal 3 damage to opponent's base
};

/**
 * Puzzle-mode dispatch wrapper.
 *
 * Calls processDispatch normally, then automatically resolves any Player 2
 * pending decisions using the global PUZZLE_AUTO_RESPONSES map. This lets
 * puzzles define worst-case opponent behaviour without any human input.
 *
 * Never used in real games — only /api/puzzle/dispatch and puzzle tests call this.
 */
export function processPuzzleDispatch(
  dispatch: GameDispatch,
  context: EngineContext,
): { response: DispatchResponse; context: EngineContext } {
  let result = processDispatch(dispatch, context);

  while (true) {
    const pending = result.context.pending;
    if (!pending) break;

    const auto = resolveAutoOption(pending);
    if (!auto) break;

    const autoDispatch: GameDispatch = {
      dispatchId: randomUUID(),
      dispatchType: auto.dispatchType,
      dispatchData: auto.dispatchData,
      fromPlayer: 2,
    };

    result = processDispatch(autoDispatch, result.context);
  }

  return result;
}

/**
 * Returns the dispatch type + data to auto-fire for Player 2, or null if no
 * auto-response is configured for this pending.
 */
function resolveAutoOption(
  pending: PendingResolution,
): { dispatchType: DispatchType; dispatchData: DispatchData } | null {
  if (pending.type === "when-defeated-choice" && pending.controlledBy === 2) {
    const option = PUZZLE_AUTO_RESPONSES[pending.defeatedCardId];
    if (option && pending.options.includes(option)) {
      return { dispatchType: "choose-option", dispatchData: { option } };
    }
  }
  return null;
}
