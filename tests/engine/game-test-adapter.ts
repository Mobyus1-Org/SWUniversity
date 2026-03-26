/**
 * GameTestAdapter
 *
 * Thin synchronous wrapper around the puzzle engine's dispatch layer.
 * Provides semantic helper methods matching the unit test DSL from the spec.
 * Intended for use in Vitest tests under tests/engine/.
 */

import {
  createPuzzleRuntime,
  hydrateGame,
  type RawGameState,
} from "@/server/puzzle/adapters/puzzle-runtime";
import { resolveEngineAction } from "@/server/puzzle/adapters/resolve-action";
import { CardPower, CardHp } from "@/server/engine/card-db/generated";
import type {
  PuzzleRuntime,
  PuzzleGameState,
  PuzzleUnit,
  PuzzleIntent,
  PlayerId,
} from "@/lib/puzzles/types";
import type { PuzzleUiHints } from "@/server/puzzle/adapters/resolve-action";

// ---------------------------------------------------------------------------
// Adapter class
// ---------------------------------------------------------------------------

export class GameTestAdapter {
  private _runtime: PuzzleRuntime;
  private _ui: PuzzleUiHints;

  private constructor(runtime: PuzzleRuntime) {
    this._runtime = runtime;
    this._ui = {
      selectablePlayIds: [],
      selectableBaseForPlayer: [],
      canClickLeader: false,
      selectableHandIndices: [],
      sentinelPlayIds: [],
      promptTitle: "",
      promptOptions: [],
      legalActions: [],
    };
  }

  /** Load from a raw state built via GameStateBuilder. */
  static fromRaw(raw: RawGameState): GameTestAdapter {
    const game = hydrateGame(raw);
    return GameTestAdapter.fromState(game);
  }

  /** Load from an already-hydrated PuzzleGameState. */
  static fromState(state: PuzzleGameState): GameTestAdapter {
    return new GameTestAdapter({
      game: state,
      history: [],
      log: [],
      status: "playing",
      prompt: null,
    });
  }

  // ---------------------------------------------------------------------------
  // Core dispatcher
  // ---------------------------------------------------------------------------

  private dispatch(intent: PuzzleIntent): this {
    const result = resolveEngineAction(this._runtime, intent);
    this._runtime = result.state;
    this._ui = result.ui;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Player actions
  // ---------------------------------------------------------------------------

  /** Play a card from hand by 0-based index. */
  playCardFromHand(handIndex: number): this {
    return this.dispatch({ type: "click-hand", handIndex });
  }

  /** Click an arbitrary unit by playId. */
  clickUnit(playId: string): this {
    return this.dispatch({ type: "click-unit", playId });
  }

  /**
   * Choose a ground unit by 0-based arena index.
   * Defaults to Player 1's ground arena.
   */
  chooseGroundUnit(index: number, player: PlayerId = 1): this {
    const arena =
      player === 1
        ? this._runtime.game.player1.groundArena
        : this._runtime.game.player2.groundArena;
    const unit = arena[index];
    if (!unit)
      throw new Error(`No ground unit at index ${index} for player ${player}`);
    return this.dispatch({ type: "click-unit", playId: unit.playId });
  }

  /**
   * Choose a space unit by 0-based arena index.
   * Defaults to Player 1's space arena.
   */
  chooseSpaceUnit(index: number, player: PlayerId = 1): this {
    const arena =
      player === 1
        ? this._runtime.game.player1.spaceArena
        : this._runtime.game.player2.spaceArena;
    const unit = arena[index];
    if (!unit)
      throw new Error(`No space unit at index ${index} for player ${player}`);
    return this.dispatch({ type: "click-unit", playId: unit.playId });
  }

  /** Attack (or select) the opponent's base. */
  chooseTheirBase(): this {
    return this.dispatch({ type: "click-base", player: 2 });
  }

  /** Attack (or select) the active player's own base. */
  chooseMyBase(): this {
    return this.dispatch({ type: "click-base", player: 1 });
  }

  /** Click Player 1's leader card zone. */
  chooseMyLeader(): this {
    return this.dispatch({ type: "click-leader", player: 1 });
  }

  /** Respond to an active prompt with the given option id. */
  sendPrompt(optionId: string): this {
    return this.dispatch({ type: "choose-option", optionId });
  }

  pass(): this {
    return this.dispatch({ type: "pass" });
  }

  takeInitiative(): this {
    return this.dispatch({ type: "take-initiative" });
  }

  undo(): this {
    return this.dispatch({ type: "undo" });
  }

  reset(): this {
    this._runtime = createPuzzleRuntime();
    return this;
  }

  // ---------------------------------------------------------------------------
  // State accessors
  // ---------------------------------------------------------------------------

  get runtime(): PuzzleRuntime {
    return this._runtime;
  }

  get game(): PuzzleGameState {
    return this._runtime.game;
  }

  get status() {
    return this._runtime.status;
  }

  get prompt() {
    return this._runtime.prompt;
  }

  get log(): string[] {
    return this._runtime.log;
  }

  get ui(): PuzzleUiHints {
    return this._ui;
  }

  // ---------------------------------------------------------------------------
  // Unit lookup helpers
  // ---------------------------------------------------------------------------

  /** Find a live unit by playId across all arenas of both players. */
  getUnit(playId: string): PuzzleUnit | undefined {
    const allUnits = [
      ...this.game.player1.groundArena,
      ...this.game.player1.spaceArena,
      ...this.game.player2.groundArena,
      ...this.game.player2.spaceArena,
    ];
    return allUnits.find((u) => u.playId === playId);
  }

  // ---------------------------------------------------------------------------
  // Card-stat helpers (mirror the spec's game.getPower / game.getHP interface)
  // ---------------------------------------------------------------------------

  /** Returns the unit's printed power from the card database. */
  getPower(unit: PuzzleUnit): number {
    return CardPower(unit.cardId) ?? 0;
  }

  /** Returns the unit's remaining HP (printed HP minus current damage). */
  getHP(unit: PuzzleUnit): number {
    return (CardHp(unit.cardId) ?? 0) - unit.damage;
  }
}
