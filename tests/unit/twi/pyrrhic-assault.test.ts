import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// TWI_103 Pyrrhic Assault. Cost 3 Command/Command Disaster event.
//   "For this phase, each friendly unit gains: 'When Defeated: Deal 2 damage to an enemy unit.'"
//
// The grant sits on the PLAYER for the phase, so it covers units played after the event too, and
// it stacks on top of a unit's own printed When Defeated rather than replacing it.

const PYRRHIC = Cards.events.twi.pyrrhicAssault;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const enemy = (g: GameTestAdapter) => g.state.player2.groundArena[0];

describe("TWI_103 Pyrrhic Assault", () => {
  it("a friendly unit dying deals 2 to a chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, PYRRHIC)
        .WithGroundUnitForPlayer(1, MARINE)   // 3/3, dies to the 3/7's counter
        .WithGroundUnitForPlayer(2, SECURITY)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {}); // P1 cannot act twice in a row
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy(g).playId] });
    // The Marine died to the counter; its granted When Defeated now fires.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy(g).playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(enemy(g).damage).toBe(5); // 3 combat + 2 granted
  });

  it("control: without the event, the same trade deals only the combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, SECURITY).Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy(g).playId] });

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(enemy(g).damage).toBe(3);
  });

  it("does not grant the trigger to the OPPONENT's units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, PYRRHIC)
        .WithGroundUnitForPlayer(1, SECURITY) // 3/7 attacker, survives
        .WithGroundUnitForPlayer(2, MARINE)   // 3/3, dies
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {}); // P1 cannot act twice in a row
    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemy(g).playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    // No prompt is owed: the dead unit was the opponent's, so nothing was granted to it.
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena[0].damage).toBe(3); // just the counter
  });
});
