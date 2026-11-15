import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_014 Sly Moore — Cipher in the Dark (leader; 3/6 Ground deployed, Cunning/Villainy)
//   Front: "Action [1 resource, Exhaust]: If there are 4 or more exhausted units in play, create a
//           Spy token."
//   Deployed: "On Attack: You may deal 2 damage to an exhausted unit."
//
// "In play" counts both sides. The condition is soft: with 3 exhausted units the cost is still paid.

const SLY = Cards.leaders.sec.slyMoore;
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce;
const SPY = Cards.units.token.spy;

const spies = (g: GameTestAdapter) => g.state.player1.groundArena.filter(u => u.cardId === SPY).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(SLY)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithActivePlayer(1);
}

describe("SEC_014 Sly Moore — leader Action", () => {
  it("creates a Spy with 4 exhausted units in play, counting both sides", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE, false)
        .WithGroundUnitForPlayer(1, MARINE, false)
        .WithGroundUnitForPlayer(2, MARINE, false)
        .WithGroundUnitForPlayer(2, MARINE, false)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(spies(g)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
  });

  it("with only 3 exhausted units, pays and creates nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE, false)
        .WithGroundUnitForPlayer(2, MARINE, false)
        .WithGroundUnitForPlayer(2, MARINE, false)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(spies(g)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
  });
});

describe("SEC_014 Sly Moore — deployed On Attack", () => {
  function deployed() {
    return setup().MyLeader(SLY, true, true).WithGroundUnitForPlayer(1, SLY);
  }

  it("may deal 2 damage to an exhausted unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, CSF, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, CSF, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("asks nothing when no unit is exhausted (a ready unit is not a target)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, CSF).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
