import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import { SetGame } from "@/server/engine/core-functions";
import type { EngineContext, PendingResolution } from "@/server/engine/pending-resolution";
import type { EngineTransport } from "@/lib/engine/engine-transport";
import type { Game } from "@/lib/engine/game";
import type { GameDispatch, DispatchResponse } from "@/lib/engine/message-types";

/**
 * Puzzle-mode in-process transport.
 *
 * Identical to InProcessTransport except it routes through processPuzzleDispatch
 * so that Player 2 decisions with configured auto-responses are resolved
 * automatically. Use this transport in puzzle tests and the puzzle runtime.
 */
export class PuzzleInProcessTransport implements EngineTransport {
  private _pending: PendingResolution | null = null;

  constructor(private readonly _game: Game) {}

  async sendDispatchAsync(dispatch: GameDispatch): Promise<DispatchResponse> {
    const context: EngineContext = { game: this._game, pending: this._pending };
    const { response, context: newContext } = processPuzzleDispatch(dispatch, context);

    this._game.currentGameState = newContext.game.currentGameState;
    this._game.gameStateHistory = newContext.game.gameStateHistory;
    this._game.gameLog = newContext.game.gameLog;
    this._pending = newContext.pending;

    SetGame(this._game);

    return response;
  }
}
