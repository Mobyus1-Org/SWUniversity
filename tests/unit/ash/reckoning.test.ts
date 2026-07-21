import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_187 Reckoning (Event, cost 3)
// "Deal damage to a unit equal to the total amount of damage on all units you control."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_187 Reckoning", () => {
  it("deals damage equal to the total damage on all friendly units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.reckoning)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 4) // 4 damage
        .WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer, true, 2)     // 2 damage
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)          // 3/7 target
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(6);
  });

  it("ignores damage on ENEMY units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.reckoning)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 2)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer, true, 5) // 4/10, enemy damage
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(7); // 5 existing + 2 dealt, not 5 + 7
  });

  it("deals 0 damage when no friendly unit is damaged (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.reckoning)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("can defeat the target when the total is lethal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.reckoning)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 6)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("can target a friendly unit too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.reckoning)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 3)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(6); // 3 existing + 3 dealt
  });
});
