import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_157 Relentless Firespray (4/6 Space, cost 6, Underworld Vehicle Transport, Aggression)
//   "On Attack: Ready this unit. Use this ability only once each round."
//
// The attacker is exhausted as part of resolving the attack, AFTER its On Attack abilities, so
// "ready this unit" must land after that exhaust or it is undone.

const FIRESPRAY = Cards.units.jtl.relentlessFirespray;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(1)
    .WithSpaceUnitForPlayer(1, FIRESPRAY);
}

describe("JTL_157 Relentless Firespray", () => {
  it("is ready again after its first attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4);
    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("only once each round: the second attack leaves it exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(8);
    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });

  it("the limit resets next round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    // End the round: both players pass, then skip the regroup resource step.
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);
    expect(g.state.gamePhase).toBe("ActionPhase");
    expect(g.state.player1.spaceArena[0].ready).toBe(true);

    const actor = g.state.activePlayer;
    if (actor === 2) await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("each copy tracks its own use", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, FIRESPRAY).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithSpaceUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena[0].ready).toBe(true);
    expect(g.state.player1.spaceArena[1].ready).toBe(true);
  });

  it("control: a unit without the ability ends its attack exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing)
      .Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });
});
