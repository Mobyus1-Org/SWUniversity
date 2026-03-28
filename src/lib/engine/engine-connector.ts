import { Game } from "@/lib/engine/game";
import { DispatchData, DispatchType, GameDispatch, DispatchResponse } from "@/lib/engine/message-types";
import { randomUUID } from "crypto";
import { PlayerId } from "@/lib/engine/core-models";
import type { EngineTransport, TransportFactory } from "@/lib/engine/engine-transport";

export class EngineConnector {
  private _game: Game = {} as Game;
  private _transport?: EngineTransport;

  /**
   * @param transportFactory  Called with the newly-created Game once
   *                          connectToEngine() runs. Use InProcessTransport
   *                          for tests/server, HttpTransport for remote UIs.
   */
  constructor(private readonly _transportFactory: TransportFactory) {}

  connectToEngine(): void {
    this._game = {
      id: randomUUID(),
      currentGameState: {} as never,
      gameStateHistory: [],
      gameLog: [],
    };
    this._transport = this._transportFactory(this._game);
  }

  get Game(): Game {
    if (!this._game?.id) {
      throw new Error("Not connected to engine.");
    }
    return this._game;
  }

  createDispatch(player: PlayerId, dispatchType: DispatchType, dispatchData: DispatchData): GameDispatch {
    return {
      dispatchId: randomUUID(),
      dispatchType,
      dispatchData,
      fromPlayer: player,
    };
  }

  async sendDispatchAsync(dispatch: GameDispatch): Promise<DispatchResponse> {
    if (!this._transport) {
      throw new Error("Not connected to engine.");
    }
    return this._transport.sendDispatchAsync(dispatch);
  }
}