import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_144 No Disintegrations (Event, cost 3, Aggression/Villainy)
//   "Deal damage to a non-leader unit equal to 1 less than its remaining HP."

const WAMPA = Cards.units.sor.wampa;                // 4/5 Ground
const AWING = Cards.units.jtl.phoenixSquadronAWing; // 3/2 Space — a pilot host
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, Cards.events.jtl.noDisintegrations);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_144 No Disintegrations", () => {
  it("leaves an undamaged unit at 1 remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });

  it("uses REMAINING HP — a pre-damaged unit takes less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, WAMPA, true, 2).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4); // 2 + (3 - 1)
  });

  it("counts HP bonuses (Experience)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, MARINE) // 3/3 → 4/4
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("a unit at 1 remaining HP takes 0 — and keeps its Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, WAMPA, true, 4)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const wampa = g.state.player2.groundArena[0];
    expect(wampa.damage).toBe(4);
    expect(wampa.upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.token.shield]);
  });

  it("a Shield absorbs the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, WAMPA)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    const wampa = g.state.player2.groundArena[0];
    expect(wampa.damage).toBe(0);
    expect(wampa.upgrades).toHaveLength(0);
  });

  it("offers non-leader units on either side — not a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, WAMPA)
      .WithSpaceUnitForPlayer(2, AWING)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.leaders.jtl.lukeSkywalker, 2)])
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect([...offer(g)].sort()).toEqual([
      g.state.player1.groundArena[0].playId,
      g.state.player2.groundArena[0].playId,
    ].sort());
  });
});
