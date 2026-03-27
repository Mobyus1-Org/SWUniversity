import type { EngineTransport } from "@/lib/engine/engine-transport";
import type { Game } from "@/lib/engine/game";
import type { GameDispatch, GameMessage, DispatchResponse } from "@/lib/engine/message-types";

/**
 * HTTP transport — communicates with the engine over the network.
 *
 * Used by any external UI client that wants to connect to a remote engine
 * server. Calls POST /api/engine/dispatch, round-tripping the opaque context
 * (game state + pending resolution) so the server stays stateless.
 *
 * The shared Game reference is updated after every successful dispatch so that
 * consumers (e.g. EngineConnector.Game) always reflect the latest state.
 */
export class HttpTransport implements EngineTransport {
  private _context: unknown = null;

  constructor(
    private readonly _game: Game,
    private readonly _baseUrl: string,
  ) {}

  async sendDispatchAsync(dispatch: GameDispatch): Promise<DispatchResponse> {
    const message: GameMessage = {
      gameId: this._game.id,
      dispatch,
    };

    const res = await fetch(`${this._baseUrl}/api/engine/dispatch`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message, context: this._context }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Engine HTTP ${res.status}: ${text}`);
    }

    const body = await res.json() as {
      response: DispatchResponse;
      context: unknown;
    };

    this._context = body.context;

    if (body.response.newGameState) {
      this._game.currentGameState = body.response.newGameState;
    }

    return body.response;
  }
}
