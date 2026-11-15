import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";

// SOR_115 Agent Kallus — Seeking the Rebels (4/4 Ground, cost 5, Command)
//   "Ambush"
//   "When another unique unit is defeated: You may draw a card. Use this ability only once each round."
//
// Either side's unique unit. Non-unique deaths do nothing; a declined offer keeps the round's use.

const KALLUS = Cards.units.sor.agentKallus;
const KUIIL = Cards.units.shd.kuiil;               // unique 2/3
const MARINE = Cards.units.sor.battlefieldMarine;  // non-unique 3/3
const CSF = Cards.units.sor.consularSecurityForce; // 3/7

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, KALLUS)
    .WithGroundUnitForPlayer(1, CSF)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithActivePlayer(1);
}

async function csfAttacks(g: GameTestAdapter, enemyIdx: number) {
  await g.attackWithGroundUnitAsync(1, 1);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[enemyIdx].playId] });
}

describe("SOR_115 Agent Kallus", () => {
  it("has Ambush", () => {
    expect(HasAmbush(KALLUS)).toBe(true);
  });

  it("an enemy unique unit defeated: may draw a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, KUIIL).Build());

    await csfAttacks(g, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(1);
  });

  it("a non-unique unit defeated: nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await csfAttacks(g, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.hand.length).toBe(0);
  });

  it("once each round: a second unique death the same round offers nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, KUIIL).WithGroundUnitForPlayer(2, Cards.units.sor.wolffe).Build());

    await csfAttacks(g, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0); // Kallus himself attacks Wolffe (3/2)
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.hand.length).toBe(1);
  });

  it("declining keeps the round's use", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, KUIIL).WithGroundUnitForPlayer(2, Cards.units.sor.wolffe).Build());

    await csfAttacks(g, 0);
    await g.chooseNoAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(1);
  });
});
