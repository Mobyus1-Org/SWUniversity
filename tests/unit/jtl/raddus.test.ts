import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// JTL_104 Raddus / Holdo's Final Command (8/6 Space, Resistance Vehicle Capital Ship)
// "While you control another Resistance card (unit, upgrade, or leader), this unit gains Sentinel."
// "When Defeated: Deal damage equal to this unit's power to an enemy unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

describe("JTL_104 Raddus — Sentinel while controlling another Resistance card", () => {
  it("has Sentinel while another friendly Resistance card is in play", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.raddus)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.blackOne) // Resistance
        .Build(),
    );

    const raddus = g.state.player1.spaceArena[0];
    expect(HasSentinel(raddus.cardId, raddus.playId, 1)).toBe(true);
  });

  it("does NOT have Sentinel with no other Resistance card (control case)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.raddus)
        .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft) // non-Resistance
        .Build(),
    );

    const raddus = g.state.player1.spaceArena[0];
    expect(HasSentinel(raddus.cardId, raddus.playId, 1)).toBe(false);
  });

  it("Raddus alone does not count itself — no Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithSpaceUnitForPlayer(1, Cards.units.jtl.raddus).Build(),
    );

    const raddus = g.state.player1.spaceArena[0];
    expect(HasSentinel(raddus.cardId, raddus.playId, 1)).toBe(false);
  });
});

describe("JTL_104 Raddus — When Defeated deals damage equal to its power", () => {
  // Raddus (8/6) attacks Devastator (10/10) — Raddus takes 10 and dies. Its When Defeated
  // then deals 8 (its power) to a chosen enemy unit. Redemption (6/9) survives to show it.
  function combatSetup() {
    return baseSetup()
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.raddus)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.devastator) // 10/10 defender
      .WithSpaceUnitForPlayer(2, Cards.units.sor.redemption); // 6/9 clean target
  }

  it("deals 8 damage to a chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(combatSetup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0); // attack the Devastator; Raddus dies
    expect(g.state.player1.spaceArena).toHaveLength(0); // Raddus gone

    await g.chooseSpaceUnitAsync(2, 1); // When Defeated target — Redemption

    expect(g.state.player2.spaceArena[1].damage).toBe(8); // Redemption took 8, survives (9 HP)
  });

  it("prompts for an enemy unit when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(combatSetup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    const after = await g.chooseSpaceUnitAsync(2, 0);

    // Raddus died, so the When Defeated target prompt must be live.
    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(after.lastDispatchResponse?.resolutionNeeded).toBeDefined();
  });

  it("can defeat a small enemy unit with the 8 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.raddus)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.devastator) // defender kills Raddus
        .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft) // 3/4 — dies to 8
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(2, 1); // hit the System Patrol Craft (4 HP) with 8

    // The Patrol Craft is defeated; only the Devastator remains.
    expect(g.state.player2.spaceArena).toHaveLength(1);
    expect(g.state.player2.spaceArena[0].cardId).toBe(Cards.units.sor.devastator);
  });
});

// In puzzle mode the opponent (P2) controls Raddus. When the solver defeats it, its When Defeated
// deals damage to one of the solver's (P1) units — and the puzzle auto-resolver must pick that
// target deterministically: ready units first, then highest current power (exhausted only as a
// last resort). The solver's Devastator (idx 0) always kills Raddus and becomes exhausted itself.
describe("JTL_104 Raddus — puzzle auto-resolver target priority", () => {
  type SpaceUnit = { cardId: string; ready: boolean; damage?: number };

  function buildRaw(p1Space: SpaceUnit[]) {
    return {
      activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
      initiativePlayer: 1, initiativeClaimed: true,
      player1: {
        base: { cardId: "SOR_029", damage: 0, epicActionUsed: false },
        leader: { cardId: "SOR_007", ready: true, deployed: false, epicActionUsed: false },
        groundArena: [],
        spaceArena: p1Space.map(u => ({
          cardId: u.cardId, playId: "@", owner: 1, controller: 1,
          ready: u.ready, damage: u.damage ?? 0, upgrades: [], captives: [],
        })),
        resources: Array(3).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
        discard: [], deck: [], hand: [],
        supplemental: { creditTokens: 0, forceToken: false },
      },
      player2: {
        base: { cardId: "SOR_023", damage: 0, epicActionUsed: false },
        leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
        groundArena: [],
        // Raddus (6 HP) pre-damaged to 1 HP so any P1 attacker finishes it and fires When Defeated.
        spaceArena: [
          { cardId: "JTL_104", playId: "@", owner: 2, controller: 2, ready: true, damage: 5, upgrades: [], captives: [] },
        ],
        resources: Array(3).fill(null).map(() => ({ cardId: "LAW_174", playId: "@", owner: 2, controller: 2, ready: true })),
        discard: [], deck: [], hand: [],
        supplemental: { creditTokens: 0, forceToken: false },
      },
      currentEffects: [], triggerBag: [],
    };
  }

  function newCtx(p1Space: SpaceUnit[]): EngineContext {
    const gs = hydratePuzzleGame(buildRaw(p1Space) as never);
    const game: Game = { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] };
    return { game, pending: null };
  }

  function dispatch(ctx: EngineContext, type: string, data: Record<string, unknown>) {
    return processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 },
      ctx,
    );
  }

  /** Solver's Devastator (space idx 0) attacks and defeats Raddus, firing its When Defeated. */
  function defeatRaddus(ctx: EngineContext) {
    const attackerId = ctx.game.currentGameState.player1.spaceArena[0].playId;
    const raddusId = ctx.game.currentGameState.player2.spaceArena[0].playId;
    let res = dispatch(ctx, "initiate-attack", { playId: attackerId });
    if (res.response.resolutionNeeded) {
      res = dispatch(res.context, "choose-target", { targetPlayIds: [raddusId] });
    }
    return res;
  }

  it("targets a ready unit over a higher-power exhausted one", () => {
    // idx0 Devastator (10 power) attacks Raddus → becomes exhausted. idx1 Patrol Craft (3 power)
    // stays ready. Ready-first must pick the Patrol Craft even though the Devastator outpowers it.
    const ctx = newCtx([
      { cardId: Cards.units.sor.devastator, ready: true },
      { cardId: Cards.units.sor.systemPatrolCraft, ready: true },
    ]);
    const res = defeatRaddus(ctx);
    const gs = res.context.game.currentGameState;

    expect(res.context.pending).toBeNull();
    expect(gs.player2.spaceArena.some(u => u.cardId === "JTL_104")).toBe(false); // Raddus defeated
    // Patrol Craft (4 HP) took the 8 → defeated. Devastator kept only its 8 combat counter-damage.
    expect(gs.player1.spaceArena.some(u => u.cardId === Cards.units.sor.systemPatrolCraft)).toBe(false);
    const devastator = gs.player1.spaceArena.find(u => u.cardId === Cards.units.sor.devastator)!;
    expect(devastator.damage).toBe(8);
  });

  it("among ready units, targets the highest current power", () => {
    // Ready units after the attack: Patrol Craft (3) and Redemption (6). Redemption must be chosen.
    const ctx = newCtx([
      { cardId: Cards.units.sor.devastator, ready: true },
      { cardId: Cards.units.sor.systemPatrolCraft, ready: true },
      { cardId: Cards.units.sor.redemption, ready: true },
    ]);
    const res = defeatRaddus(ctx);
    const gs = res.context.game.currentGameState;

    expect(res.context.pending).toBeNull();
    const redemption = gs.player1.spaceArena.find(u => u.cardId === Cards.units.sor.redemption)!;
    const patrol = gs.player1.spaceArena.find(u => u.cardId === Cards.units.sor.systemPatrolCraft)!;
    expect(redemption.damage).toBe(8); // Redemption (9 HP) took the 8, survives
    expect(patrol.damage).toBe(0);     // Patrol Craft untouched
  });

  it("with no ready unit, targets the highest-power exhausted unit", () => {
    // idx0 Devastator (10) exhausts itself attacking; idx1 Redemption (6) is already exhausted.
    // No ready units remain → highest-power exhausted (Devastator) is chosen.
    const ctx = newCtx([
      { cardId: Cards.units.sor.devastator, ready: true },
      { cardId: Cards.units.sor.redemption, ready: false },
    ]);
    const res = defeatRaddus(ctx);
    const gs = res.context.game.currentGameState;

    expect(res.context.pending).toBeNull();
    // Devastator: 8 combat + 8 When Defeated = 16 on a 10-HP body → defeated.
    expect(gs.player1.spaceArena.some(u => u.cardId === Cards.units.sor.devastator)).toBe(false);
    const redemption = gs.player1.spaceArena.find(u => u.cardId === Cards.units.sor.redemption)!;
    expect(redemption.damage).toBe(0); // lower-power exhausted unit untouched
  });
});
