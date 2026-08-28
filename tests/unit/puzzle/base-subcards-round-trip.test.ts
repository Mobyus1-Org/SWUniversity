import { describe, it, expect } from "vitest";
import { toRaw, fromRaw, type BuilderState, type PlayerBuilderState } from "@/components/Shared/puzzle-builder-state";
import { hydratePuzzleGame, type RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import { Cards } from "../../card-helpers";

// The base hosts two kinds of sub-card: Fortify upgrades ("Attach this to your base, not a unit")
// and captives taken by the base itself (SEC_195 Arrest). Both are OPTIONAL fields on `Base`,
// which is exactly the shape that goes missing silently — the hand-written mirrors (puzzle
// hydrator, builder toRaw/parseRawPlayer, StaticBoard) are not compiler-enforced against the
// interface, so each one gets a round trip here.

const FORTIFY = "HMW_081";                          // Alliance Shield Generator
const ARRESTED = Cards.units.sor.battlefieldMarine;

function player(overrides: Partial<PlayerBuilderState> = {}): PlayerBuilderState {
  return {
    baseCardId: "SOR_029", baseDamage: 0, baseEpicActionUsed: false,
    baseUpgrades: [], baseCaptives: [],
    leaderCardId: "SOR_017", leaderReady: true, leaderDeployed: false,
    leaderEpicActionUsed: false, leaderFlipped: false,
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

type RawBase = { base: { upgrades?: { cardId: string }[]; captives?: { cardId: string; owner: number }[] } };

describe("base sub-cards — builder ↔ raw ↔ live state", () => {
  it("an ordinary base still serialises with no sub-card fields at all", () => {
    const raw = toRaw(builderState(player(), player())) as unknown as { player1: RawBase };

    expect(raw.player1.base.upgrades).toBeUndefined();
    expect(raw.player1.base.captives).toBeUndefined();
  });

  it("writes Fortify upgrades and base captives when present", () => {
    const raw = toRaw(builderState(
      player({ baseUpgrades: [{ cardId: FORTIFY }], baseCaptives: [{ cardId: ARRESTED }] }),
      player(),
    )) as unknown as { player1: RawBase };

    expect(raw.player1.base.upgrades!.map(u => u.cardId)).toEqual([FORTIFY]);
    expect(raw.player1.base.captives!.map(c => c.cardId)).toEqual([ARRESTED]);
    // A captive is owned by whoever it was taken FROM — the opponent unless marked friendly.
    expect(raw.player1.base.captives![0].owner).toBe(2);
  });

  it("round-trips through toRaw/fromRaw", () => {
    const original = builderState(
      player({ baseUpgrades: [{ cardId: FORTIFY }], baseCaptives: [{ cardId: ARRESTED }] }),
      player(),
    );

    const reloaded = fromRaw(
      toRaw(original) as unknown as Record<string, unknown>,
      { name: "t", description: "", difficulty: 1 },
    );

    expect(reloaded.player1.baseUpgrades.map(u => u.cardId)).toEqual([FORTIFY]);
    expect(reloaded.player1.baseCaptives.map(c => c.cardId)).toEqual([ARRESTED]);
    expect(reloaded.player2.baseUpgrades).toEqual([]);
    expect(reloaded.player2.baseCaptives).toEqual([]);
  });

  it("survives hydration into a live game state", () => {
    const raw = toRaw(builderState(
      player({ baseUpgrades: [{ cardId: FORTIFY }], baseCaptives: [{ cardId: ARRESTED }] }),
      player(),
    )) as unknown as RawPuzzleGameState;

    const game = hydratePuzzleGame(raw);

    expect(game.player1.base.upgrades!.map(u => u.cardId)).toEqual([FORTIFY]);
    expect(game.player1.base.captives!.map(c => c.cardId)).toEqual([ARRESTED]);
    expect(game.player1.base.captives![0].owner).toBe(2);
    // Real playIds are assigned at hydration, not the "@" placeholder the builder writes.
    expect(game.player1.base.captives![0].playId).not.toBe("@");
    // A base with nothing attached hydrates to empty arrays, never undefined.
    expect(game.player2.base.upgrades).toEqual([]);
    expect(game.player2.base.captives).toEqual([]);
  });
});
