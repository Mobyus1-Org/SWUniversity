import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// Abilities whose text hands the choice to "an opponent" belong to Player 2 in a puzzle. The
// solver must never be prompted for them — puzzle-dispatch auto-answers on P2's behalf, worst
// case for the solver and deterministically so a puzzle replays identically.
//
//  * SEC_193 Grand Admiral Thrawn (Grand Schemer) — "An opponent may choose a non-leader unit
//    they control. If they do, this unit captures that unit. If they don't, ready this unit."
//    P2 gives up a unit whenever they have one: the cheapest non-Sentinel, or — if every unit
//    has Sentinel — the one with the least remaining HP.
//  * SHD_014 Cad Bane (He Who Needs No Introduction) — "an opponent chooses a unit they control.
//    Deal 1 damage to it." P2 feeds it a non-Sentinel unit with the most remaining HP, so the
//    ping is wasted and their blockers stay up.

type P2Unit = { cardId: string; ready?: boolean; damage?: number };

function buildRaw(p2Ground: P2Unit[], p1Hand: string[]) {
  return {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_029", damage: 0, epicActionUsed: false },
      leader: { cardId: "SHD_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: [], spaceArena: [],
      resources: Array(12).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: p1Hand.map(cardId => ({ cardId })),
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: p2Ground.map(u => ({
        cardId: u.cardId, playId: "@", owner: 2, controller: 2,
        ready: u.ready !== false, damage: u.damage ?? 0, upgrades: [], captives: [],
      })),
      spaceArena: [],
      resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
      discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
}

function newCtx(p2Ground: P2Unit[], p1Hand: string[]): EngineContext {
  const gs = hydratePuzzleGame(buildRaw(p2Ground, p1Hand) as never);
  const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
  return { game, pending: null };
}

function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
    ctx,
  );
}

/** Plays the single card in P1's hand. */
function playFromHand(ctx: EngineContext, cardId: string) {
  return dispatch(ctx, "play-card", { cardId, fromZone: "Hand" });
}

describe("SEC_193 Thrawn — the opponent's give-up-a-unit choice is automated in puzzles", () => {
  it("never prompts the solver, and P2 gives up their cheapest non-Sentinel unit", () => {
    const ctx = newCtx(
      [{ cardId: "SOR_046" }, { cardId: "ASH_237" }, { cardId: "SOR_095" }], // costs 4, 1, 2
      ["SEC_193"],
    );
    const res = playFromHand(ctx, "SEC_193");

    expect(res.response.resolutionNeeded).toBeFalsy(); // the solver is never asked
    const gs = res.context.game.currentGameState;
    const thrawn = gs.player1.groundArena.find(u => u.cardId === "SEC_193")!;
    expect(thrawn.captives.map(c => c.cardId)).toEqual(["ASH_237"]); // the 1-cost unit
    expect(gs.player2.groundArena.map(u => u.cardId).sort()).toEqual(["SOR_046", "SOR_095"]);
  });

  it("skips Sentinel units even when one is cheaper", () => {
    const ctx = newCtx(
      [{ cardId: "LAW_049" }, { cardId: "SOR_046" }], // Sentinel cost 3, non-Sentinel cost 4
      ["SEC_193"],
    );
    const res = playFromHand(ctx, "SEC_193");

    const thrawn = res.context.game.currentGameState.player1.groundArena.find(u => u.cardId === "SEC_193")!;
    expect(thrawn.captives.map(c => c.cardId)).toEqual(["SOR_046"]);
  });

  it("gives up the least remaining HP when every unit has Sentinel", () => {
    const ctx = newCtx(
      [{ cardId: "LAW_049", damage: 0 }, { cardId: "LAW_254", damage: 2 }], // 3 HP vs 1 HP left
      ["SEC_193"],
    );
    const res = playFromHand(ctx, "SEC_193");

    const thrawn = res.context.game.currentGameState.player1.groundArena.find(u => u.cardId === "SEC_193")!;
    expect(thrawn.captives.map(c => c.cardId)).toEqual(["LAW_254"]);
  });

  it("readies Thrawn instead when the opponent controls no unit", () => {
    const ctx = newCtx([], ["SEC_193"]);
    const res = playFromHand(ctx, "SEC_193");

    expect(res.response.resolutionNeeded).toBeFalsy();
    const thrawn = res.context.game.currentGameState.player1.groundArena.find(u => u.cardId === "SEC_193")!;
    expect(thrawn.ready).toBe(true);
    expect(thrawn.captives).toHaveLength(0);
  });

  it("ignores the opponent's leader unit as a give-up candidate", () => {
    const ctx = newCtx([{ cardId: "SOR_046" }], ["SEC_193"]);
    // Deploy P2's leader into the arena alongside the unit.
    ctx.game.currentGameState.player2.leader.deployed = true;
    ctx.game.currentGameState.player2.groundArena.push({
      cardId: "JTL_014", playId: "500", owner: 2, controller: 2,
      ready: true, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false,
    } as never);

    const res = playFromHand(ctx, "SEC_193");

    const thrawn = res.context.game.currentGameState.player1.groundArena.find(u => u.cardId === "SEC_193")!;
    expect(thrawn.captives.map(c => c.cardId)).toEqual(["SOR_046"]);
  });
});

describe("SHD_014 Cad Bane — the opponent's damage-target choice is automated in puzzles", () => {
  it("never prompts the solver and pings a non-Sentinel unit with the most remaining HP", () => {
    const ctx = newCtx(
      [{ cardId: "SOR_046", damage: 5 }, { cardId: "SOR_095" }], // 2 HP left vs 3 HP left
      ["LAW_032"], // Cad Bane (Underworld unit) — playing it triggers the leader reaction
    );
    const res = playFromHand(ctx, "LAW_032");
    let cur = res;
    // Accept the optional leader reaction if the solver is offered it (that half is P1's choice).
    if (cur.response.resolutionNeeded?.type === "Option") {
      cur = dispatch(cur.context, "choose-option", { option: "Yes" });
    }

    expect(cur.response.resolutionNeeded).toBeFalsy(); // P2's target choice was automated
    const gs = cur.context.game.currentGameState;
    const marine = gs.player2.groundArena.find(u => u.cardId === "SOR_095")!;
    expect(marine.damage).toBe(1); // the healthiest non-Sentinel took the ping
    expect(gs.player2.groundArena.find(u => u.cardId === "SOR_046")!.damage).toBe(5);
  });

  it("prefers a non-Sentinel unit even when a Sentinel has more remaining HP", () => {
    const ctx = newCtx(
      [{ cardId: "LAW_049" }, { cardId: "ASH_237" }], // Sentinel 3 HP vs non-Sentinel 1 HP
      ["LAW_032"],
    );
    let cur = playFromHand(ctx, "LAW_032");
    if (cur.response.resolutionNeeded?.type === "Option") {
      cur = dispatch(cur.context, "choose-option", { option: "Yes" });
    }

    const gs = cur.context.game.currentGameState;
    expect(gs.player2.groundArena.find(u => u.cardId === "LAW_049")!.damage).toBe(0);
    // The 1/1 non-Sentinel absorbed the ping and died.
    expect(gs.player2.groundArena.some(u => u.cardId === "ASH_237")).toBe(false);
  });
});
