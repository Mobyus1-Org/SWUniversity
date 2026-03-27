import { CardInPlay, GamePhase, PlayerId } from "@/lib/engine/core-models";
import { GameState, PlayerState } from "@/lib/engine/game";

function emptyPlayer(): PlayerState {
  return {
    base: { cardId: "", epicActionUsed: false, damage: 0, numUses: 0 },
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

export class GameStateBuilder {
  private _raw: GameState;

  constructor() {
    this._raw = {
      activePlayer: 1 as PlayerId,
      gamePhase: "ActionPhase" as GamePhase,
      nextPlayId: 1,
      player1: emptyPlayer(),
      player2: emptyPlayer(),
      currentEffects: [],
      currentRound: 1,
      initiativePlayer: 1 as PlayerId,
      initiativeClaimed: false,
      defeatedPlayers: [],
      triggerBag: [],
      roundState: {
        cardsPlayedThisPhase: [],
        cardsEnteredPlayThisPhase: [],
        cardsLeftPlayThisPhase: [],
        unitsAttackedThisPhase: [],
      },
    };
  }

  // ---------------------------------------------------------------------------
  // Global state
  // ---------------------------------------------------------------------------

  WithActivePlayer(player: PlayerId): this {
    this._raw.activePlayer = player;
    return this;
  }

  WithGamePhase(phase: GamePhase): this {
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

  MyBase(cardId: string, damage = 0, epicActionUsed = false, numUses = 0): this {
    this._raw.player1.base = { cardId, epicActionUsed, damage, numUses };
    return this;
  }

  TheirBase(cardId: string, damage = 0, epicActionUsed = false, numUses = 0): this {
    this._raw.player2.base = { cardId, epicActionUsed, damage, numUses };
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
    controller: PlayerId = player,
    stolen: boolean = false,
  ): this {
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    for (let i = 0; i < count; i++) {
      p.resources.push({ cardId, playId: "@", owner: player, controller, ready, stolen });
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
    controller: PlayerId = player,
    numUses = 0,
    isClone = false,
  ): this {
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    p.groundArena.push({
      cardId,
      playId: "@",
      owner: player,
      controller,
      ready,
      damage,
      upgrades: [],
      captives: [],
      numUses,
      isClone,
    });
    return this;
  }

  WithSpaceUnitForPlayer(
    player: PlayerId,
    cardId: string,
    ready = true,
    damage = 0,
    controller: PlayerId = player,
    numUses = 0,
    isClone = false,
  ): this {
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    p.spaceArena.push({
      cardId,
      playId: "@",
      owner: player,
      controller,
      ready,
      damage,
      upgrades: [],
      captives: [],
      numUses,
      isClone,
    });
    return this;
  }

  WithUpgradesOnGroundUnitForPlayer(
    player: PlayerId,
    unitIndex: number,
    upgrades: CardInPlay[]
  ): this {
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    p.groundArena[unitIndex].upgrades = upgrades;
    return this;
  }

  WithUpgradesOnSpaceUnitForPlayer(
    player: PlayerId,
    unitIndex: number,
    upgrades: CardInPlay[]
  ): this {
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    upgrades.forEach((up) => {
      if (up.playId === "@") {
        up.playId = String(this._raw.nextPlayId++);
      }
    });
    p.spaceArena[unitIndex].upgrades = upgrades;
    return this;
  }

  // ---------------------------------------------------------------------------
  // Deck
  // ---------------------------------------------------------------------------

  WithCardInDeckForPlayer(player: PlayerId, cardId: string): this {
    const p = player === 1 ? this._raw.player1 : this._raw.player2;
    p.deck.push({ cardId });
    return this;
  }

  // ---------------------------------------------------------------------------
  // Defeated players
  // ---------------------------------------------------------------------------

  WithDefeatedPlayer(player: PlayerId): this {
    this._raw.defeatedPlayers.push(player);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Current effects
  // ---------------------------------------------------------------------------

  WithCurrentEffect(effect: GameState["currentEffects"][number]): this {
    this._raw.currentEffects.push(effect);
    return this;
  }

  WithCurrentEffects(effects: GameState["currentEffects"]): this {
    this._raw.currentEffects.push(...effects);
    return this;
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  static Upgrade(cardId: string, player: PlayerId, owner: PlayerId = player): CardInPlay {
    return {
      cardId,
      playId: "@",
      owner: owner,
      controller: player
    }
  }

  // ---------------------------------------------------------------------------
  // Build
  // ---------------------------------------------------------------------------

  Build(): GameState {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const raw = structuredClone(this._raw) as any;
    let nextId = raw.nextPlayId as number;

    const resolveId = (id: string): string => (id === "@" ? String(nextId++) : id);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mapUnit = (u: any): any => ({
      ...u,
      playId: resolveId(u.playId),
      numUses: u.numUses ?? 0,
      upgrades: u.upgrades.map(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (up: any) => ({ ...up, playId: resolveId(up.playId) }),
      ),
      captives: u.captives.map(mapUnit),
    });

    const mapPlayer = (p: typeof raw.player1) => ({
      ...p,
      base: { numUses: 0, ...p.base },
      leader: { deployedPlayId: undefined, ...p.leader },
      spaceArena: p.spaceArena.map(mapUnit),
      groundArena: p.groundArena.map(mapUnit),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      resources: p.resources.map((r: any) => ({
        stolen: false,
        ...r,
        playId: resolveId(r.playId),
      })),
    });

    const player1 = mapPlayer(raw.player1);
    const player2 = mapPlayer(raw.player2);

    return {
      ...raw,
      nextPlayId: nextId,
      player1,
      player2,
    } as GameState;
  }
}
