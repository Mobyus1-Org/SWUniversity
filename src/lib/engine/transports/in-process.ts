import { processDispatch } from "@/server/engine/dispatch-listener";
import { SetGame } from "@/server/engine/core-functions";
import type { EngineContext, PendingResolution } from "@/server/engine/pending-resolution";
import type { EngineTransport } from "@/lib/engine/engine-transport";
import type { Game } from "@/lib/engine/game";
import type { GameDispatch, DispatchResponse } from "@/lib/engine/message-types";

/**
 * In-process transport — calls processDispatch directly in the same runtime.
 *
 * Used for:
 *   - Unit tests (no network overhead)
 *   - Server-side components that talk to the engine locally
 *
 * Holds the shared Game reference passed from EngineConnector so that state
 * updates are immediately visible to all holders of that reference.
 */
export class InProcessTransport implements EngineTransport {
  private _pending: PendingResolution | null = null;

  constructor(private readonly _game: Game) {}

  async sendDispatchAsync(dispatch: GameDispatch): Promise<DispatchResponse> {
    const context: EngineContext = { game: this._game, pending: this._pending };
    const { response, context: newContext } = processDispatch(dispatch, context);

    this._game.currentGameState = newContext.game.currentGameState;
    this._game.gameStateHistory = newContext.game.gameStateHistory;
    this._game.gameLog = newContext.game.gameLog;
    this._pending = newContext.pending;

    // Restore the game singleton so callers can use engine functions
    // (e.g. CurrentPower()) after the dispatch without re-entering processDispatch.
    SetGame(this._game);

    return response;
  }
}
