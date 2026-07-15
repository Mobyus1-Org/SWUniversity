import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_014 The Mandalorian (We Can't Keep Running) — leader, 4/6 Ground when deployed
// Leader side: "When you take the initiative: You may pay 1 resource. If you do, draw a card."
// Deployed:    "Support (When you deploy this leader, you may attack with another unit…)"
//              "On Attack: If you have the initiative, you may draw a card."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.ash.theMandalorian)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine);
}

describe("ASH_014 The Mandalorian (We Can't Keep Running)", () => {
  it("leader side: claiming initiative lets you pay 1 to draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const handBefore = g.state.player1.hand.length;
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;

    await g.dispatchAsync(1, "claim-initiative", {});
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore + 1);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 1);
  });

  it("declining the initiative reaction costs nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());
    const handBefore = g.state.player1.hand.length;

    const claimed = await g.dispatchAsync(1, "claim-initiative", {});
    expect(claimed.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore);
  });

  it("Support: deploying him lets another unit attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1);           // Support
    await g.chooseGroundUnitAsync(1, 0); // the Marine attacks
    await g.chooseBaseAsync(1, 2);
    // The Marine also gained his "On Attack: draw a card" — Support lends every other ability.
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("deployed On Attack: draws a card while you have the initiative", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.theMandalorian, true, true)
        .WithInitiativePlayerBeing(1)
        .WithGroundUnitForPlayer(1, Cards.units.ash.theMandalorian)
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(handBefore + 1);
  });

  it("deployed On Attack: no draw without the initiative", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.ash.theMandalorian, true, true)
        .WithInitiativePlayerBeing(2)
        .WithGroundUnitForPlayer(1, Cards.units.ash.theMandalorian)
        .Build(),
    );
    const handBefore = g.state.player1.hand.length;

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseBaseAsync(1, 2);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand.length).toBe(handBefore);
  });
});
