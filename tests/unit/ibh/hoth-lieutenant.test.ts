import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_064 Hoth Lieutenant (3/4 Ground, cost 4, Imperial Trooper)
// "When Played: You may attack with another unit. It gets +2/+0 for this attack."

function setup(hothId = Cards.units.ibh.hothLieutenant, withOtherUnit = true) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, hothId);
  if (withOtherUnit) b = b.WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine); // 3/3
  return b;
}

describe("IBH_064 Hoth Lieutenant — When Played: may attack with another unit +2/+0", () => {
  it("the chosen unit attacks with +2/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0); // play Hoth Lieutenant
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(1, 0); // the other Marine attacks
    await g.chooseBaseAsync(1, 2); // hit the enemy base

    expect(g.state.player2.base.damage).toBe(5); // Marine 3 power + 2
  });

  it("declining makes no attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    const after = await g.chooseOptionAsync(1, "No");

    expect(after.lastDispatchResponse).toBeDefined();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("control: no other ready unit → no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ibh.hothLieutenant, false).Build());

    const after = await g.playCardFromHandAsync(1, 0);

    expect(after.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("alt printing IBH_092 also grants the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.ibh.hothLieutenantB).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5);
  });
});
