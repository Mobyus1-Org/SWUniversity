import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// A decision that belongs to Player 2 must never reach the solver. Before this guard, a P2
// pending with no configured auto-response simply fell through and the human answered it —
// resolving an ENEMY ability, spending the opponent's Force token and choosing their targets.
// That is how QA hit Karis (LOF_031), who now has a configured auto-target of her own.
//
// Rather than guess an answer (which would silently pick a line nobody chose), puzzle dispatch
// now throws and names the card, so the missing entry gets added.

/** P1 can kill a P2 unit with Vanquish; both players hold a Force token. */
function buildRaw(p2Ground: { cardId: string }[], p1Ground: { cardId: string }[] = []) {
  return {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_020", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_005", ready: true, deployed: false, epicActionUsed: false },
      groundArena: p1Ground.map(u => ({
        cardId: u.cardId, playId: "@", owner: 1, controller: 1,
        ready: true, damage: 0, upgrades: [], captives: [],
      })),
      spaceArena: [],
      resources: Array(12).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [{ cardId: "SOR_078" }], // Vanquish
      supplemental: { creditTokens: 0, forceToken: true },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: p2Ground.map(u => ({
        cardId: u.cardId, playId: "@", owner: 2, controller: 2,
        ready: true, damage: 0, upgrades: [], captives: [],
      })),
      spaceArena: [],
      resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
      discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: true }, // P2 can pay Karis's Force cost
    },
    currentEffects: [], triggerBag: [],
  };
}

function newCtx(p2Ground: { cardId: string }[], p1Ground: { cardId: string }[] = []): EngineContext {
  const gs = hydratePuzzleGame(buildRaw(p2Ground, p1Ground) as never);
  const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
  return { game, pending: null };
}

function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
    ctx,
  );
}

describe("puzzle mode — an unaccounted-for opponent decision fails fast", () => {
  it("throws, naming card and subtitle, for a P2 decision with no auto-response configured", () => {
    // ASH_195 Helgait — "When Defeated: You may distribute Advantage tokens equal to this unit's
    // power among friendly units." P2's call, and not in the auto registry. If it ever IS mapped,
    // swap this for another unmapped card rather than deleting the case.
    const ctx = newCtx([{ cardId: "ASH_195" }, { cardId: "SOR_095" }]); // needs a friendly survivor
    const res = dispatch(ctx, "play-card", { cardId: "SOR_078", fromZone: "Hand" });
    const helgait = res.context.game.currentGameState.player2.groundArena[0];

    expect(() =>
      dispatch(res.context, "choose-target", { targetPlayIds: [helgait.playId] }),
    ).toThrow("Puzzle Auto Target not set for Helgait - Dooku Was a Visionary");
  });

  it("names a card that has no subtitle without a trailing dash", () => {
    // SOR_108 Vanguard Infantry — "When Defeated: You may give an Experience token to a unit."
    // No subtitle, so the message must be just the title.
    const ctx = newCtx([{ cardId: "SOR_108" }], [{ cardId: "SOR_095" }]);
    const res = dispatch(ctx, "play-card", { cardId: "SOR_078", fromZone: "Hand" });
    const target = res.context.game.currentGameState.player2.groundArena[0];

    expect(() =>
      dispatch(res.context, "choose-target", { targetPlayIds: [target.playId] }),
    ).toThrow("Puzzle Auto Target not set for Vanguard Infantry");
  });

  it("control: the SOLVER's own optional ability is still handed to them, not thrown", () => {
    // P1's own Karis dying is P1's decision — the guard must not touch it.
    const ctx = newCtx([{ cardId: "SOR_095" }], [{ cardId: "LOF_031" }]);
    const res = dispatch(ctx, "play-card", { cardId: "SOR_078", fromZone: "Hand" });
    const ownKaris = res.context.game.currentGameState.player1.groundArena[0];

    const after = dispatch(res.context, "choose-target", { targetPlayIds: [ownKaris.playId] });
    expect(after.response.resolutionNeeded?.type).toBe("Option"); // prompted, not thrown
  });

  it("control: a configured opponent decision still auto-resolves silently", () => {
    // SEC_193 Thrawn is in the registry, so P2 answers for themselves and nothing throws.
    const ctx = newCtx([{ cardId: "SOR_095" }]);
    const gs = ctx.game.currentGameState;
    gs.player1.hand = [{ cardId: "SEC_193" }];

    const res = dispatch(ctx, "play-card", { cardId: "SEC_193", fromZone: "Hand" });
    expect(res.response.resolutionNeeded).toBeFalsy();
  });
});
