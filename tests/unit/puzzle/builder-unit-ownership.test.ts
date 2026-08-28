import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { toRaw, fromRaw, type BuilderState, type PlayerBuilderState, type UnitEntry } from "@/components/Shared/puzzle-builder-state";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// A unit's OWNER and its CONTROLLER are not the same thing. Control effects (Traitorous, No Glory
// Only Results, Change of Heart) move a unit into the opponent's arena while its owner is unchanged
// — and the engine cares: a defeated unit goes to its OWNER's discard, and a bounced one to its
// OWNER's hand. The builder used to stamp the arena's player onto both, so those board states were
// simply unauthorable.

function player(overrides: Partial<PlayerBuilderState> = {}): PlayerBuilderState {
  return {
    baseCardId: "SOR_029", baseDamage: 0, baseEpicActionUsed: false, baseUpgrades: [], baseCaptives: [],
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

const unit = (over: Partial<UnitEntry> = {}): UnitEntry =>
  ({ cardId: "SOR_051", ready: true, damage: 0, upgrades: [], captives: [], ...over });

type RawUnit = { cardId: string; owner: number; controller: number; upgrades: { owner: number; controller: number }[]; captives: { owner: number }[] };
type RawSide = { groundArena: RawUnit[]; spaceArena: RawUnit[] };
const raw = (s: BuilderState) => toRaw(s) as unknown as { player1: RawSide; player2: RawSide };

describe("puzzle builder — unit ownership", () => {
  it("defaults to the player whose arena it is", () => {
    const r = raw(builderState(player({ groundUnits: [unit()] }), player()));

    expect(r.player1.groundArena[0].owner).toBe(1);
    expect(r.player1.groundArena[0].controller).toBe(1);
  });

  it("a P1-owned unit in P2's arena keeps P2 as controller", () => {
    const r = raw(builderState(player(), player({ groundUnits: [unit({ owner: 1 })] })));

    expect(r.player2.groundArena[0].owner).toBe(1);
    expect(r.player2.groundArena[0].controller).toBe(2); // the arena IS the controller
  });

  it("a P2-owned unit in P1's arena keeps P1 as controller", () => {
    const r = raw(builderState(player({ spaceUnits: [unit({ cardId: "SOR_231", owner: 2 })] }), player()));

    expect(r.player1.spaceArena[0].owner).toBe(2);
    expect(r.player1.spaceArena[0].controller).toBe(1);
  });

  it("round-trips an override through toRaw → fromRaw", () => {
    const before = builderState(player(), player({ groundUnits: [unit({ owner: 1 })] }));
    const after = fromRaw(toRaw(before) as unknown as Record<string, unknown>, { name: "t", description: "", difficulty: 1 });

    expect(after.player2.groundUnits[0].owner).toBe(1);
  });

  it("round-trips a DEFAULT owner back to undefined, so re-export is unchanged", () => {
    // Storing an explicit `1` here would still serialise correctly, but every untouched puzzle
    // would come back from an import differing from the file it was loaded from.
    const before = builderState(player({ groundUnits: [unit()] }), player());
    const after = fromRaw(toRaw(before) as unknown as Record<string, unknown>, { name: "t", description: "", difficulty: 1 });

    expect(after.player1.groundUnits[0].owner).toBeUndefined();
  });

  it("upgrades still key off the CONTROLLER, not the overridden owner", () => {
    // A friendly upgrade on a P2-controlled, P1-owned unit belongs to P2 — the controller.
    const r = raw(builderState(
      player(),
      player({ groundUnits: [unit({ owner: 1, upgrades: [{ cardId: "SOR_120" }] })] }),
    ));

    const upgrade = r.player2.groundArena[0].upgrades[0];
    expect(upgrade.owner).toBe(2);
    expect(upgrade.controller).toBe(2);
  });

  it("captives still belong to the controller's opponent, not the overridden owner", () => {
    const r = raw(builderState(
      player(),
      player({ groundUnits: [unit({ owner: 1, captives: [{ cardId: "SOR_095" }] })] }),
    ));

    expect(r.player2.groundArena[0].captives[0].owner).toBe(1); // P2 captured it from P1
  });

  it("a P1-owned unit defeated in P2's arena goes to P1's discard", () => {
    // The whole point of the field: prove the builder's output reaches the engine behaviour.
    const state = builderState(
      player({
        handCards: ["SOR_078"], // Vanquish
        resources: Array(8).fill(null).map(() => ({ cardId: "SOR_059", ready: true })),
      }),
      player({ groundUnits: [unit({ owner: 1 })] }), // P2 controls it; P1 owns it
    );
    const gs = hydratePuzzleGame(toRaw(state) as never);
    const ctx: EngineContext = { game: { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] } as Game, pending: null };

    const played = processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: "play-card" as never, dispatchData: { cardId: "SOR_078", fromZone: "Hand" } as never, fromPlayer: 1 },
      ctx,
    );
    const target = played.context.game.currentGameState.player2.groundArena[0];
    const after = processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: "choose-target" as never, dispatchData: { targetPlayIds: [target.playId] } as never, fromPlayer: 1 },
      played.context,
    );

    const end = after.context.game.currentGameState;
    expect(end.player2.groundArena).toHaveLength(0);
    expect(end.player1.discard.map(d => d.cardId)).toContain("SOR_051");
    expect(end.player2.discard.map(d => d.cardId)).not.toContain("SOR_051");
  });
});
