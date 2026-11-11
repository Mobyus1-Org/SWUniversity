import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SEC_101 Queen Amidala on Player 2's side: "If damage would be dealt to this unit, you may defeat
// another friendly unit that shares a trait with this unit. If you do, prevent that damage."
// In a puzzle P2 is automated (QA's rule):
//   - damage that would NOT defeat her: she takes it, nothing is sacrificed;
//   - damage that WOULD defeat her: sacrifice the first of non-Sentinel → least remaining HP →
//     least power → lowest cost.

const AMIDALA = Cards.units.sec.queenAmidala;          // 5/3 Naboo/Official
const SPY = Cards.units.token.spy;                     // 0/2 Official token
const AIDE = Cards.units.sec.supremeCouncilAide;       // 2/2 Official, cost 1
const CHAMPION = Cards.units.sec.populistChampion;     // 3/5 Official, cost 3
const GIDEON = Cards.units.ash.moffGideonRemnantCommander; // 2/5 Official, Sentinel
const WAMPA = Cards.units.sor.wampa;                   // 4/5
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3
const OPEN_FIRE = Cards.events.sor.openFire;           // Deal 4 damage to a unit
const XP = Cards.upgrades.token.experience;

type RawUnit = { cardId: string; playId: string; owner: 1 | 2; controller: 1 | 2; ready: boolean; damage: number; upgrades: unknown[]; captives: [] };
const unit = (cardId: string, playId: string, player: 1 | 2, upgrades: unknown[] = []): RawUnit =>
  ({ cardId, playId, owner: player, controller: player, ready: true, damage: 0, upgrades, captives: [] });
const xpTokens = (n: number) =>
  Array.from({ length: n }, (_, i) => ({ cardId: XP, playId: `xp${i}`, owner: 2, controller: 2 }));

function newCtx(p1Ground: RawUnit[], p2Ground: RawUnit[]): EngineContext {
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 100, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: true, deployed: false, epicActionUsed: false },
      groundArena: p1Ground,
      spaceArena: [], discard: [], deck: [], hand: [{ cardId: OPEN_FIRE }],
      resources: Array.from({ length: 6 }, (_, i) => ({ cardId: MARINE, playId: `r${i}`, owner: 1, controller: 1, ready: true, stolen: false })),
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: true, deployed: false, epicActionUsed: false },
      groundArena: p2Ground,
      spaceArena: [], resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
  const gs = hydratePuzzleGame(raw as never);
  const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
  return { game, pending: null };
}

function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
    ctx,
  );
}

function openFireOnAmidala(ctx: EngineContext) {
  const played = dispatch(ctx, "play-card", { cardId: OPEN_FIRE, fromZone: "Hand" });
  return dispatch(played.context, "choose-target", { targetPlayIds: ["20"] });
}

const p2Ids = (res: { context: EngineContext }) =>
  res.context.game.currentGameState.player2.groundArena.map(u => u.playId);
const amidala = (res: { context: EngineContext }) =>
  res.context.game.currentGameState.player2.groundArena.find(u => u.playId === "20");

describe("SEC_101 Queen Amidala — P2's prevention is automated in puzzles (ability damage)", () => {
  it("lethal damage: sacrifices a non-Sentinel over a Sentinel, and Amidala takes nothing", () => {
    const res = openFireOnAmidala(newCtx([], [unit(AMIDALA, "20", 2), unit(GIDEON, "21", 2), unit(CHAMPION, "22", 2)]));

    expect(res.response.invalidAction).toBeFalsy();
    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(p2Ids(res)).toEqual(["20", "21"]); // Champion (non-Sentinel) went, Gideon stays
    expect(amidala(res)!.damage).toBe(0);
  });

  it("among non-Sentinels the least remaining HP goes first", () => {
    const res = openFireOnAmidala(newCtx([], [unit(AMIDALA, "20", 2), unit(CHAMPION, "21", 2), unit(AIDE, "22", 2)]));

    expect(p2Ids(res)).toEqual(["20", "21"]); // the 2-HP Aide, not the 5-HP Champion
    expect(amidala(res)!.damage).toBe(0);
  });

  it("then the least power: a 0/2 Spy before a 2/2 Aide", () => {
    const res = openFireOnAmidala(newCtx([], [unit(AMIDALA, "20", 2), unit(AIDE, "21", 2), unit(SPY, "22", 2)]));

    expect(p2Ids(res)).toEqual(["20", "21"]);
  });

  it("a Sentinel is sacrificed when it is the only option", () => {
    const res = openFireOnAmidala(newCtx([], [unit(AMIDALA, "20", 2), unit(GIDEON, "21", 2)]));

    expect(p2Ids(res)).toEqual(["20"]);
    expect(amidala(res)!.damage).toBe(0);
  });

  it("non-lethal damage: she takes it and nothing is sacrificed", () => {
    // Two Experience tokens make her 7/5, so Open Fire's 4 leaves her at 1.
    const res = openFireOnAmidala(newCtx([], [unit(AMIDALA, "20", 2, xpTokens(2)), unit(SPY, "21", 2)]));

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(p2Ids(res)).toEqual(["20", "21"]);
    expect(amidala(res)!.damage).toBe(4);
  });
});

describe("ASH_062 The Mandalorian — P2's Shield spend follows the same lethality rule", () => {
  const MANDO = Cards.units.ash.theMandalorianDevotedRescuer; // 5/4, Shield on him
  const shield = [{ cardId: Cards.upgrades.token.shield, playId: "sh", owner: 2, controller: 2 }];

  it("spends his Shield to save a friendly unit the damage would defeat", () => {
    const res = openFireOnAmidala(newCtx([], [unit(SPY, "20", 2), unit(MANDO, "21", 2, shield)])); // 4 at a 0/2

    expect(res.response.invalidAction).toBeFalsy();
    expect(p2Ids(res)).toEqual(["20", "21"]);
    expect(res.context.game.currentGameState.player2.groundArena[1].upgrades).toHaveLength(0);
  });

  it("keeps his Shield when the friendly unit survives the damage", () => {
    const res = openFireOnAmidala(newCtx([], [unit(CHAMPION, "20", 2), unit(MANDO, "21", 2, shield)])); // 4 at a 3/5

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(amidala(res)!.damage).toBe(4);
    expect(res.context.game.currentGameState.player2.groundArena[1].upgrades).toHaveLength(1);
  });
});

describe("SEC_101 Queen Amidala — P2's prevention is automated in puzzles (combat damage)", () => {
  it("a lethal attack on her: a sacrifice is made and she takes no combat damage", () => {
    const declared = dispatch(newCtx([unit(WAMPA, "10", 1)], [unit(AMIDALA, "20", 2), unit(SPY, "21", 2)]), "initiate-attack", { playId: "10" });
    const res = dispatch(declared.context, "choose-target", { targetPlayIds: ["20"] });

    expect(res.response.invalidAction).toBeFalsy();
    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(p2Ids(res)).toEqual(["20"]);
    expect(amidala(res)!.damage).toBe(0);
  });

  it("a non-lethal attack: she takes the damage, nothing is sacrificed", () => {
    const declared = dispatch(newCtx([unit(MARINE, "10", 1)], [unit(AMIDALA, "20", 2, xpTokens(2)), unit(SPY, "21", 2)]), "initiate-attack", { playId: "10" });
    const res = dispatch(declared.context, "choose-target", { targetPlayIds: ["20"] });

    expect(res.response.resolutionNeeded).toBeFalsy();
    expect(p2Ids(res)).toEqual(["20", "21"]);
    expect(amidala(res)!.damage).toBe(3);
  });
});
