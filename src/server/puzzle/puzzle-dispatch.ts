import { randomUUID } from "crypto";
import { processDispatch } from "@/server/engine/dispatch-listener";
import type { EngineContext, PendingResolution } from "@/server/engine/pending-resolution";
import type { GameDispatch, DispatchResponse } from "@/lib/engine/message-types";
import type { DispatchType, DispatchData } from "@/lib/engine/message-types";

/**
 * Puzzle-mode dispatch wrapper.
 *
 * Calls processDispatch normally, then automatically resolves any Player 2
 * pending decisions that have a configured auto-response in
 * `gameState.puzzleAutoResponses`. This lets puzzle designers define worst-case
 * opponent behaviour without any human input on Player 2's side.
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
    const autoResponses = result.context.game.currentGameState.puzzleAutoResponses;
    if (!pending || !autoResponses) break;

    const auto = resolveAutoOption(pending, autoResponses);
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
 *
 * Extend this switch as new puzzle auto-response types are needed.
 */
function resolveAutoOption(
  pending: PendingResolution,
  autoResponses: Record<string, string>,
): { dispatchType: DispatchType; dispatchData: DispatchData } | null {
  if (pending.type === "when-defeated-choice" && pending.controlledBy === 2) {
    const option = autoResponses[pending.defeatedCardId];
    if (option && pending.options.includes(option)) {
      return { dispatchType: "choose-option", dispatchData: { option } };
    }
  }
  return null;
}
