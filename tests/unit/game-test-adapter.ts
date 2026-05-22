import { PlayerId } from "@/lib/engine/core-models";
import { EngineConnector } from "@/lib/engine/engine-connector";
import { Game, GameState } from "@/lib/engine/game";
import { DispatchData, DispatchResponse, DispatchType, GameDispatch } from "@/lib/engine/message-types";
import { InProcessTransport } from "@/lib/engine/transports/in-process";
import { SetGame } from "@/server/engine/core-functions";
import { randomUUID } from "crypto";

export class GameTestAdapter {
  private _game: Game = {} as Game;
  private _engineConnector: EngineConnector = new EngineConnector(
    (game) => new InProcessTransport(game),
  );
  private _lastDispatchResponse: DispatchResponse | null = null;

  constructor(autoconnect: boolean = true) {
    if (autoconnect) {
      this.connectToEngine();
      this._game = this._engineConnector.Game;
    }
  }

  connectToEngine(): void {
    this._engineConnector.connectToEngine();
    this._game = this._engineConnector.Game;
  }

  loadNewState(gameState: GameState): void {
    this._game.currentGameState = gameState;
    this._game.gameStateHistory = [];
    this._game.gameLog = ["Loaded new game state."];
    SetGame(this._game);
  }

  get state(): GameState {
    return this._game.currentGameState;
  }

  get game(): GameState {
    return this._game.currentGameState;
  }

  get lastDispatchResponse(): DispatchResponse | null {
    return this._lastDispatchResponse;
  }

  async dispatchAsync(player: PlayerId, dispatchType: DispatchType, dispatchData: DispatchData): Promise<GameTestAdapter> {
    const message: GameDispatch = {
      dispatchId: randomUUID(),
      dispatchType,
      dispatchData,
      fromPlayer: player,
    };

    this._lastDispatchResponse = await this._engineConnector.sendDispatchAsync(message);

    return this;
  }

  async useLeaderAbilityAsync(player: PlayerId): Promise<GameTestAdapter> {
    const cardId = (player === 1 ? this.state.player1 : this.state.player2).leader.cardId;
    return this.dispatchAsync(player, "use-ability", { cardId });
  }

  async useBaseEpicActionAsync(player: PlayerId): Promise<GameTestAdapter> {
    const cardId = (player === 1 ? this.state.player1 : this.state.player2).base.cardId;
    return this.dispatchAsync(player, "use-ability", { cardId });
  }

  async deployLeaderAsync(player: PlayerId, epicAction = true): Promise<GameTestAdapter> {
    const cardId = (player === 1 ? this.state.player1 : this.state.player2).leader.cardId;
    return this.dispatchAsync(player, "use-ability", { cardId, deployLeader: true, epicAction });
  }

  async playCardFromHandAsync(player: PlayerId, handIndex: number): Promise<GameTestAdapter> {
    const cardId = (player === 1 ? this.state.player1 : this.state.player2).hand[handIndex].cardId;
    return this.dispatchAsync(player, "play-card", { cardId, fromZone: "Hand" });
  }

  async attackWithGroundUnitAsync(player: PlayerId, unitIndex: number): Promise<GameTestAdapter> {
    const currentPlayId = (player === 1 ? this.state.player1 : this.state.player2).groundArena[unitIndex].playId;
    return this.dispatchAsync(player, "initiate-attack", { playId: currentPlayId });
  }

  async attackWithSpaceUnitAsync(player: PlayerId, unitIndex: number): Promise<GameTestAdapter> {
    const currentPlayId = (player === 1 ? this.state.player1 : this.state.player2).spaceArena[unitIndex].playId;
    return this.dispatchAsync(player, "initiate-attack", { playId: currentPlayId });
  }

  async chooseGroundUnitAsync(player: PlayerId, unitIndex: number): Promise<GameTestAdapter> {
    const playerState = player === 1 ? this.state.player1 : this.state.player2;
    const targetPlayId = playerState.groundArena[unitIndex].playId;
    return this.dispatchAsync(player, "choose-target", { targetPlayIds: [targetPlayId] });
  }

  async chooseSpaceUnitAsync(player: PlayerId, unitIndex: number): Promise<GameTestAdapter> {
    const playerState = player === 1 ? this.state.player1 : this.state.player2;
    const targetPlayId = playerState.spaceArena[unitIndex].playId;
    return this.dispatchAsync(player, "choose-target", { targetPlayIds: [targetPlayId] });
  }

  async chooseLeaderAsync(player: PlayerId): Promise<GameTestAdapter> {
    return this.dispatchAsync(player, "choose-target", { targetZones: ["Leader"], targetPlayers: [player] });
  }

  async chooseBaseAsync(from: PlayerId, target: PlayerId): Promise<GameTestAdapter> {
    return this.dispatchAsync(from, "choose-target", { targetZones: ["Base"], targetPlayers: [target] });
  }

  async chooseCardFromHandAsync(player: PlayerId, handIndex: number): Promise<GameTestAdapter> {
    return this.dispatchAsync(player, "choose-target", { targetZones: ["Hand"], targetPlayers: [player], targetIndices: [handIndex] });
  }

  /** Sends choose-target with multiple friendly ground unit playIds for Exploit resolution. */
  async exploitGroundUnitsAsync(player: PlayerId, unitIndices: number[]): Promise<GameTestAdapter> {
    const pState = player === 1 ? this.state.player1 : this.state.player2;
    const targetPlayIds = unitIndices.map(i => pState.groundArena[i].playId);
    return this.dispatchAsync(player, "choose-target", { targetPlayIds });
  }

  async choosePilotVehicleGroundAsync(player: PlayerId, unitIndex: number): Promise<GameTestAdapter> {
    const pState = player === 1 ? this.state.player1 : this.state.player2;
    const targetPlayId = pState.groundArena[unitIndex].playId;
    return this.dispatchAsync(player, "choose-target", { targetPlayIds: [targetPlayId] });
  }

  async choosePilotVehicleSpaceAsync(player: PlayerId, unitIndex: number): Promise<GameTestAdapter> {
    const pState = player === 1 ? this.state.player1 : this.state.player2;
    const targetPlayId = pState.spaceArena[unitIndex].playId;
    return this.dispatchAsync(player, "choose-target", { targetPlayIds: [targetPlayId] });
  }

  async chooseOptionAsync(player: PlayerId, option: string): Promise<GameTestAdapter> {
    return this.dispatchAsync(player, "choose-option", { option });
  }

  async chooseYesAsync(player: PlayerId): Promise<GameTestAdapter> {
    return this.chooseOptionAsync(player, "Yes");
  }

  async chooseNoAsync(player: PlayerId): Promise<GameTestAdapter> {
    return this.chooseOptionAsync(player, "No");
  }

  async regroupResourceAsync(player: PlayerId, handIndex: number): Promise<GameTestAdapter> {
    return this.dispatchAsync(player, "regroup-resource", { handIndex });
  }

  async passResourceAsync(player: PlayerId): Promise<GameTestAdapter> {
    return this.dispatchAsync(player, "pass-resource", {});
  }

  async smuggleResourceAsync(player: PlayerId, resourceIndex: number): Promise<GameTestAdapter> {
    const pState = player === 1 ? this.state.player1 : this.state.player2;
    const playId = pState.resources[resourceIndex].playId;
    return this.dispatchAsync(player, "play-smuggle", { playId });
  }

  async choosePlotCardAsync(player: PlayerId, resourceIndex: number): Promise<GameTestAdapter> {
    const pState = player === 1 ? this.state.player1 : this.state.player2;
    const targetPlayId = pState.resources[resourceIndex].playId;
    return this.dispatchAsync(player, "choose-target", { targetPlayIds: [targetPlayId] });
  }

  async passPlotAsync(player: PlayerId): Promise<GameTestAdapter> {
    return this.dispatchAsync(player, "choose-target", { targetPlayIds: [] });
  }

  /**
   * Targets an upgrade (by position) on a unit in the given arena.
   * fromPlayer = who dispatches choose-target.
   * unitPlayer = whose arena contains the unit.
   */
  async chooseUpgradeOnGroundUnitAsync(fromPlayer: PlayerId, unitPlayer: PlayerId, unitIndex: number, upgradeIndex = 0): Promise<GameTestAdapter> {
    const pState = unitPlayer === 1 ? this.state.player1 : this.state.player2;
    const upgradePlayId = pState.groundArena[unitIndex].upgrades[upgradeIndex].playId;
    return this.dispatchAsync(fromPlayer, "choose-target", { targetPlayIds: [upgradePlayId] });
  }

  async chooseUpgradeOnSpaceUnitAsync(fromPlayer: PlayerId, unitPlayer: PlayerId, unitIndex: number, upgradeIndex = 0): Promise<GameTestAdapter> {
    const pState = unitPlayer === 1 ? this.state.player1 : this.state.player2;
    const upgradePlayId = pState.spaceArena[unitIndex].upgrades[upgradeIndex].playId;
    return this.dispatchAsync(fromPlayer, "choose-target", { targetPlayIds: [upgradePlayId] });
  }
}
