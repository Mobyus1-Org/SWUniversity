import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_182 Bravado (Event, cost 5, Aggression)
//   "If you've defeated an enemy unit this phase, this event costs 2 resources less to play.
//    Ready a unit."
//
// "You've defeated" is about WHO defeated it: an enemy unit killed by your unit in combat (either
// attacking or defending) or by your ability counts; an opponent defeating their own unit doesn't.

const BRAVADO = Cards.events.shd.bravado;
const MARINE = Cards.units.sor.battlefieldMarine;      // 3/3
const DURABLE = Cards.units.sor.consularSecurityForce; // 3/7

function base(resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Aggression — no penalty on Bravado
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, BRAVADO);
}

const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const passP2 = (g: GameTestAdapter) => g.dispatchAsync(2, "pass-action", {});
/** The play was refused for COST — not for turn order or a missing card. */
const refusedForCost = (g: GameTestAdapter) => {
  expect(g.state.player1.hand).toHaveLength(1);
  expect(g.lastDispatchResponse?.invalidReason ?? "").toMatch(/cannot afford/);
};

describe("SHD_182 Bravado", () => {
  it("after your unit defeats an enemy in combat, it costs 3 — and readies a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(3)
        .WithGroundUnitForPlayer(1, DURABLE)
        .WithGroundUnitForPlayer(2, MARINE, true, 2) // 1 HP left
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    await passP2(g);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(ready(g)).toBe(0);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("with no defeat this phase it costs the full 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(3).WithGroundUnitForPlayer(1, DURABLE, false).Build());

    await g.playCardFromHandAsync(1, 0);

    refusedForCost(g); // 3 resources can't cover 5
  });

  it("an ENEMY attacker dying to your defender's counter-damage counts as yours", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(3)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, DURABLE)
        .WithGroundUnitForPlayer(2, MARINE, true, 1) // 2 HP left — dies to 3 counter-damage
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player2.groundArena).toHaveLength(0);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(ready(g)).toBe(0);
  });

  it("a defeat by your ABILITY counts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(20)
        .WithCardInHandForPlayer(1, Cards.events.twi.deathByDroids)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.dispatchAsync(1, "play-card", { cardId: Cards.events.twi.deathByDroids, fromZone: "Hand" });
    await g.chooseGroundUnitAsync(2, 0);
    await passP2(g);

    const before = ready(g);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // a Battle Droid

    expect(before - ready(g)).toBe(3);
  });

  it("YOUR unit being defeated doesn't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(3)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, DURABLE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // Marine hits the 3/7 and dies to its counter-damage
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player1.groundArena).toHaveLength(0);
    await passP2(g);

    await g.playCardFromHandAsync(1, 0);

    refusedForCost(g);
  });

  it("an opponent defeating their OWN unit doesn't count", async () => {
    const g = new GameTestAdapter();
    const state = base(3).WithGroundUnitForPlayer(1, DURABLE).Build();
    state.roundState.cardsLeftPlayThisPhase.push({ fromPlayer: 2, cardId: MARINE, playId: "gone", reason: "defeated", defeatedBy: 2 });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    refusedForCost(g);
  });

  it("'Ready a unit' may target any unit, either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(10)
        .WithGroundUnitForPlayer(1, DURABLE, false)
        .WithGroundUnitForPlayer(2, MARINE, false)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId);
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);

    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });
});
