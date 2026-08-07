import { describe, it, expect } from "vitest";
import { fromRaw, toRaw, type BuilderState, type PlayerBuilderState } from "@/components/Shared/puzzle-builder-state";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { HP_MOD, POWER_MOD } from "@/lib/engine/core-models";
import { Unit } from "@/server/engine/unit";
import { GameTestAdapter } from "../game-test-adapter";

// Authored stat modifiers — the board state a card like Overwhelming Barrage (+2/+2) or Luke's
// –6/–6 would have left behind. Stored nested under the unit because a builder unit's playId is
// the "@" placeholder, and hydration mints a fresh id per "@" — a top-level currentEffect could
// never name the unit it belongs to.

function player(overrides: Partial<PlayerBuilderState> = {}): PlayerBuilderState {
  return {
    baseCardId: "SOR_029", baseDamage: 0, baseEpicActionUsed: false,
    leaderCardId: "SOR_017", leaderReady: true, leaderDeployed: false, leaderEpicActionUsed: false,
    resources: [], handCards: [], deck: [], discard: [], groundUnits: [], spaceUnits: [],
    creditTokens: 0, forceToken: false,
    ...overrides,
  } as PlayerBuilderState;
}

function builderState(p1: PlayerBuilderState, p2: PlayerBuilderState): BuilderState {
  return {
    name: "t", description: "", infoText: "", difficulty: 1, author: "",
    intendedSolution: [], hints: [], assetPath: "",
    activePlayer: 1, gamePhase: "ActionPhase", currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: false,
    player1: p1, player2: p2,
  } as BuilderState;
}

/** Consular Security Force — 3/7 Ground, no abilities. */
const UNIT = "SOR_046";
const unit = (overrides: Record<string, unknown> = {}) =>
  ({ cardId: UNIT, ready: true, damage: 0, upgrades: [], captives: [], ...overrides }) as never;

type RawUnit = { playId: string; buff?: { power: number; hp: number } };
type RawState = {
  player1: { groundArena: RawUnit[]; spaceArena: RawUnit[] };
  player2: { groundArena: RawUnit[]; spaceArena: RawUnit[] };
};

describe("puzzle builder — authored unit buffs", () => {
  it("saves a buff nested under the unit", () => {
    const raw = toRaw(builderState(
      player({ groundUnits: [unit({ buff: { power: 2, hp: 2 } })] }),
      player(),
    )) as unknown as RawState;

    expect(raw.player1.groundArena[0].buff).toEqual({ power: 2, hp: 2 });
  });

  it("omits an all-zero buff entirely", () => {
    const raw = toRaw(builderState(
      player({ groundUnits: [unit({ buff: { power: 0, hp: 0 } })] }),
      player(),
    )) as unknown as RawState;

    expect(raw.player1.groundArena[0].buff).toBeUndefined();
  });

  it("round-trips a negative and an asymmetric buff", () => {
    const original = builderState(
      player({
        groundUnits: [unit({ buff: { power: -6, hp: -6 } })],
        spaceUnits: [unit({ buff: { power: 2, hp: -1 } })],
      }),
      player(),
    );

    const reimported = fromRaw(
      toRaw(original) as unknown as Record<string, unknown>,
      { name: "t", description: "", difficulty: 1 },
    );

    expect(reimported.player1.groundUnits[0].buff).toEqual({ power: -6, hp: -6 });
    expect(reimported.player1.spaceUnits[0].buff).toEqual({ power: 2, hp: -1 });
  });

  it("drops an all-zero buff on import so a round-trip stays stable", () => {
    const reimported = fromRaw(
      { player1: { groundArena: [{ cardId: UNIT, playId: "@", owner: 1, controller: 1, buff: { power: 0, hp: 0 } }] }, player2: {} },
      { name: "t", description: "", difficulty: 1 },
    );

    expect(reimported.player1.groundUnits[0].buff).toBeUndefined();
  });

  describe("hydration into currentEffects", () => {
    const hydrate = (buff: { power: number; hp: number }, controller = 1) =>
      hydratePuzzleGame(toRaw(builderState(
        controller === 1 ? player({ groundUnits: [unit({ buff })] }) : player(),
        controller === 2 ? player({ groundUnits: [unit({ buff })] }) : player(),
      )) as never);

    it("emits one-sided sentinels aimed at the unit's real playId", () => {
      const gs = hydrate({ power: 2, hp: 2 });
      const playId = gs.player1.groundArena[0].playId;

      expect(gs.currentEffects).toEqual(expect.arrayContaining([
        { cardId: POWER_MOD, duration: "Phase", affectedPlayer: 1, targetPlayId: playId, value: 2 },
        { cardId: HP_MOD, duration: "Phase", affectedPlayer: 1, targetPlayId: playId, value: 2 },
      ]));
      // The "@" placeholder must have been resolved — an unresolved one matches no unit.
      expect(playId).not.toBe("@");
    });

    it("emits nothing for a zero half", () => {
      const gs = hydrate({ power: 3, hp: 0 });

      expect(gs.currentEffects).toHaveLength(1);
      expect(gs.currentEffects[0].cardId).toBe(POWER_MOD);
    });

    it("files the effect under the unit's controller", () => {
      const gs = hydrate({ power: 1, hp: 1 }, 2);

      expect(gs.currentEffects.every(e => e.affectedPlayer === 2)).toBe(true);
    });

    it("leaves a unit with no buff contributing no effects", () => {
      const gs = hydratePuzzleGame(toRaw(builderState(
        player({ groundUnits: [unit()] }),
        player(),
      )) as never);

      expect(gs.currentEffects).toEqual([]);
    });
  });

  describe("the engine reads the authored buff", () => {
    it("applies it to the unit's live stats", () => {
      const g = new GameTestAdapter();
      g.loadNewState(hydratePuzzleGame(toRaw(builderState(
        player({ groundUnits: [unit({ buff: { power: 2, hp: -1 } })] }),
        player(),
      )) as never));

      const u = Unit.FromInterface(g.state.player1.groundArena[0]);
      expect(u.CurrentPower()).toBe(5); // 3 + 2
      expect(u.TotalHP()).toBe(6);      // 7 - 1
    });

    it("control: the same unit without a buff has printed stats", () => {
      const g = new GameTestAdapter();
      g.loadNewState(hydratePuzzleGame(toRaw(builderState(
        player({ groundUnits: [unit()] }),
        player(),
      )) as never));

      const u = Unit.FromInterface(g.state.player1.groundArena[0]);
      expect(u.CurrentPower()).toBe(3);
      expect(u.TotalHP()).toBe(7);
    });
  });
});
