import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_016 Admiral Ackbar — It's A Trap! (leader; 3/8 Ground deployed, Cunning/Heroism)
//   Front: "Action [1 resource, Exhaust]: Exhaust a non-leader unit. If you do, its controller
//           creates an X-Wing token."
//   Deployed: "On Attack: You may exhaust a unit. If you do, its controller creates an X-Wing token."
//
// "If you do" — an already-exhausted unit can be chosen, but nothing is exhausted, so no X-Wing.
// The X-Wing goes to the exhausted unit's CONTROLLER, which is usually the opponent.

const ACKBAR = Cards.leaders.jtl.admiralAckbar;
const MARINE = Cards.units.sor.battlefieldMarine;
const XWING = Cards.units.token.xWing;

const xwings = (units: { cardId: string }[]) => units.filter(u => u.cardId === XWING).length;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(ACKBAR)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithActivePlayer(1);
}

describe("JTL_016 Admiral Ackbar — leader Action", () => {
  it("exhausts an enemy non-leader unit, and its controller creates an X-Wing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(xwings(g.state.player2.spaceArena)).toBe(1);
    expect(xwings(g.state.player1.spaceArena)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
  });

  it("choosing an already-exhausted unit exhausts nothing, so no X-Wing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE, false).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(xwings(g.state.player2.spaceArena)).toBe(0);
  });

  it("a friendly unit can be chosen — then YOU create the X-Wing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(xwings(g.state.player1.spaceArena)).toBe(1);
  });

  it("a leader unit is not a legal choice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().FillResourcesForPlayer(2, MARINE, 10).WithActivePlayer(2).Build());
    await g.deployLeaderAsync(2);
    const enemyLeader = g.state.player2.groundArena[0];

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull(); // nothing to choose
    expect(enemyLeader.ready).toBe(true);
  });
});

describe("JTL_016 Admiral Ackbar — deployed On Attack", () => {
  function deployed() {
    return setup().MyLeader(ACKBAR, true, true).WithGroundUnitForPlayer(1, ACKBAR);
  }

  it("may exhaust a unit; its controller creates an X-Wing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(xwings(g.state.player2.spaceArena)).toBe(1);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].ready).toBe(true);
    expect(xwings(g.state.player2.spaceArena)).toBe(0);
  });
});
