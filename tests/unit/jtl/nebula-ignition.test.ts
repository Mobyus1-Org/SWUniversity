import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_080 Nebula Ignition (Event, cost 9, Vigilance) — "Defeat each unit that isn't upgraded."
//
// Tokens are upgrades, so a Shield or Experience token saves a unit. Leader units aren't spared,
// and an enemy unit that can't be defeated by enemy abilities survives.

const MARINE = Cards.units.sor.battlefieldMarine;
const WAMPA = Cards.units.sor.wampa;
const CHEWIE = Cards.units.jtl.chewbacca; // can't be defeated by enemy card abilities
const up = (id: string, p: 1 | 2) => GameStateBuilder.Upgrade(id, p);

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, Cards.events.jtl.nebulaIgnition);
}

describe("JTL_080 Nebula Ignition", () => {
  it("defeats every un-upgraded unit on both sides; upgraded units — tokens included — survive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)                                              // dies
        .WithGroundUnitForPlayer(1, WAMPA)
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [up(Cards.upgrades.token.shield, 1)])   // survives
        .WithGroundUnitForPlayer(2, MARINE)                                              // dies
        .WithGroundUnitForPlayer(2, WAMPA)
        .WithUpgradesOnGroundUnitForPlayer(2, 1, [up(Cards.upgrades.sor.academyTraining, 2)]) // survives
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [up(Cards.upgrades.token.experience, 2)]) // survives
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([WAMPA]);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([WAMPA]);
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("a deployed leader with no upgrades is defeated too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.leader.deployed).toBe(false);
  });

  it("an ENEMY unit that can't be defeated by enemy abilities survives; your own doesn't", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, CHEWIE).WithGroundUnitForPlayer(2, CHEWIE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CHEWIE]);
  });

  it("the defeated units' When Defeated abilities still fire", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().MyBase(Cards.bases.common.blue30HP, 5).WithGroundUnitForPlayer(1, Cards.units.ibh.tauntaunMount).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(3); // Tauntaun Mount healed 2
  });
});
