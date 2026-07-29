import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_109 501st Liberator — "When Played: If you control another Republic unit, you may heal
// 3 damage from a base." (3-cost Command ground unit, 3/3, Republic Clone Trooper.)

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, 5)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.twi.the501stLiberator);
}

describe("TWI_109 501st Liberator", () => {
  it("heals 3 damage from your own base when you control another Republic unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(1, Cards.units.twi.cloneHeavyGunner).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2); // 5 - 3
    expect(g.state.player2.base.damage).toBe(5); // untouched
  });

  it("can heal the enemy base instead ('a base', not 'your base')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(1, Cards.units.twi.cloneHeavyGunner).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("declining the optional heal leaves both bases untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(1, Cards.units.twi.cloneHeavyGunner).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.groundArena).toHaveLength(2); // it still entered play
  });

  it("does not prompt at all when you control no other Republic unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build(), // Rebel, not Republic
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("does not count an ENEMY Republic unit ('you control')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(2, Cards.units.twi.cloneHeavyGunner).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("does not count itself as the other Republic unit ('another')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseState().Build()); // no other units at all

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena).toHaveLength(1); // it is in play — and it is Republic
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("a second copy DOES see the first one as another Republic unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState().WithGroundUnitForPlayer(1, Cards.units.twi.the501stLiberator).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2);
  });

  it("never heals past 0 damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP, 1)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.units.twi.the501stLiberator)
        .WithGroundUnitForPlayer(1, Cards.units.twi.cloneHeavyGunner)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(0);
  });
});
