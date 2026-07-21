import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_186 Treacherous Minefield (Event, cost 2)
// "Choose an arena. For this phase, each unit in that arena gains: 'On Attack: Deal 2 damage to
//  this unit.'"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 16);
}

/** Player 2 passes so player 1 can take another action in the same phase. */
async function pass2(g: GameTestAdapter) {
  await g.dispatchAsync(2, "pass-action", {});
}

describe("ASH_186 Treacherous Minefield", () => {
  it("deals 2 damage to a friendly ground unit that attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.treacherousMinefield)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ground");
    await pass2(g);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(3); // the attack still happens
  });

  it("also hits ENEMY units attacking in that arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.treacherousMinefield)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ground");
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("does not touch units in the OTHER arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.treacherousMinefield)
        .WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer) // 4/10 space
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ground"); // mine the GROUND arena
    await pass2(g);
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena[0].damage).toBe(0);
  });

  it("mines the space arena when that is chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.treacherousMinefield)
        .WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "space");
    await pass2(g);
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.spaceArena[0].damage).toBe(2);
  });

  it("a unit attacking without the minefield takes no damage (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("can defeat the attacker outright, cancelling its attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.treacherousMinefield)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mouseDroid) // 1/1 — 2 damage kills it
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ground");
    await pass2(g);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0); // it died before dealing combat damage
  });

  it("hits every attack in the phase, not just the first", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.treacherousMinefield)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "ground");
    await pass2(g);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
