/**
 * GameStateBuilder
 *
 * Fluent builder that constructs a RawGameState suitable for passing to
 * hydrateGame(). All in-play cards use "@" as their playId so hydrateGame
 * assigns sequential integers starting from nextPlayId = 1.
 *
 * Useful for unit tests and for admin tooling that generates puzzle states
 * before publishing them to the database.
 */

import type { RawGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { PlayerId } from "@/lib/puzzles/types";

// ---------------------------------------------------------------------------
// Local raw sub-types (structural mirror of the private types in puzzle-runtime)
// ---------------------------------------------------------------------------

type RawBase = { cardId: string; epicActionUsed: boolean; damage: number };

type RawLeader = {
  cardId: string;
  epicActionUsed: boolean;
  ready: boolean;
  deployed: boolean;
};

type RawCardInPlay = {
  cardId: string;
  playId: string;
  owner: PlayerId;
  controller: PlayerId;
};

type RawUnit = RawCardInPlay & {
  ready: boolean;
  damage: number;
  upgrades: RawCardInPlay[];
  captives: RawUnit[];
};

type RawResource = RawCardInPlay & { ready: boolean };

type BuilderPlayer = {
  base: RawBase;
  leader: RawLeader;
  spaceArena: RawUnit[];
  groundArena: RawUnit[];
  resources: RawResource[];
  discard: never[];
  deck: never[];
  hand: { cardId: string }[];
  supplemental: Record<string, never>;
};

function emptyPlayer(): BuilderPlayer {
  return {
    base: { cardId: "", epicActionUsed: false, damage: 0 },
    leader: { cardId: "", epicActionUsed: false, ready: true, deployed: false },
    spaceArena: [],
    groundArena: [],
    resources: [],
    discard: [],
    deck: [],
    hand: [],
    supplemental: {},
  };
}

// ---------------------------------------------------------------------------
// Builder
// ---------------------------------------------------------------------------

export class GameStateBuilder {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private _raw: any;

  constructor() {
    this._raw = {
      activePlayer: 1 as PlayerId,
      gamePhase: 0,
      nextPlayId: 1,
      player1: emptyPlayer(),
      player2: emptyPlayer(),
      currentEffects: [],
      currentRound: 1,
      initiativePlayer: 1 as PlayerId,
      initiativeClaimed: false,
      triggerBag: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Global state
  // ---------------------------------------------------------------------------

  WithActivePlayer(player: PlayerId): this {
    this._raw.activePlayer = player;
    return this;
  }

  WithGamePhase(phase: number): this {
    this._raw.gamePhase = phase;
    return this;
  }

  WithCurrentRoundBeing(round: number): this {
    this._raw.currentRound = round;
    return this;
  }

  WithInitiativePlayerBeing(player: PlayerId): this {
    this._raw.initiativePlayer = player;
    return this;
  }

  WithInitiativeClaimed(): this {
    this._raw.initiativeClaimed = true;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Bases
  // ---------------------------------------------------------------------------

  MyBase(cardId: string, damage = 0, epicActionUsed = false): this {
    this._raw.player1.base = { cardId, epicActionUsed, damage };
    return this;
  }

  TheirBase(cardId: string, damage = 0, epicActionUsed = false): this {
    this._raw.player2.base = { cardId, epicActionUsed, damage };
    return this;
  }

  // ---------------------------------------------------------------------------
  // Leaders
  // arg order: cardId, ready = true, deployed = false, epicActionUsed = false
  // ---------------------------------------------------------------------------

  MyLeader(cardId: string, ready = true, deployed = false, epicActionUsed = false): this {
    this._raw.player1.leader = { cardId, epicActionUsed, ready, deployed };
    return this;
  }

  TheirLeader(cardId: string, ready = true, deployed = false, epicActionUsed = false): this {
    this._raw.player2.leader = { cardId, epicActionUsed, ready, deployed };
    return this;
  }

  // ---------------------------------------------------------------------------
  // Resources — adds `count` copies of the same card
  // ---------------------------------------------------------------------------

  FillResourcesForPlayer(
    player: PlayerId,
    cardId: string,
    count = 1,
    ready = true,
    controller?: PlayerId,
  ): this {
    const owner = player;
    const ctrl = controller ?? owner;
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    for (let i = 0; i < count; i++) {
      p.resources.push({ cardId, playId: "@", owner, controller: ctrl, ready });
    }
    return this;
  }

  // ---------------------------------------------------------------------------
  // Hand
  // ---------------------------------------------------------------------------

  WithCardInHandForPlayer(player: PlayerId, cardId: string): this {
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    p.hand.push({ cardId });
    return this;
  }

  // ---------------------------------------------------------------------------
  // Ground / Space units
  // arg order: player, cardId, ready = true, damage = 0, controller = player
  // ---------------------------------------------------------------------------

  WithGroundUnitForPlayer(
    player: PlayerId,
    cardId: string,
    ready = true,
    damage = 0,
    controller?: PlayerId,
  ): this {
    const owner = player;
    const ctrl = controller ?? owner;
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    p.groundArena.push({
      cardId,
      playId: "@",
      owner,
      controller: ctrl,
      ready,
      damage,
      upgrades: [],
      captives: [],
    });
    return this;
  }

  WithSpaceUnitForPlayer(
    player: PlayerId,
    cardId: string,
    ready = true,
    damage = 0,
    controller?: PlayerId,
  ): this {
    const owner = player;
    const ctrl = controller ?? owner;
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    p.spaceArena.push({
      cardId,
      playId: "@",
      owner,
      controller: ctrl,
      ready,
      damage,
      upgrades: [],
      captives: [],
    });
    return this;
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  Build(): RawGameState {
    return structuredClone(this._raw) as RawGameState;
  }
}
