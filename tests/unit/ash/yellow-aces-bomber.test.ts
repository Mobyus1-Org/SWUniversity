import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_253 Yellow Aces Bomber (2/4 Space, cost 3)
// "Support (…)"
// "On Attack: If this unit is upgraded, deal 2 damage to a base."

function ownUpgrade(cardId: string) {
  return { cardId, playId: "@", owner: 1 as const, controller: 1 as const };
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_253 Yellow Aces Bomber", () => {
  it("On Attack: while upgraded, deals 2 damage to the chosen base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.yellowAcesBomber)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [ownUpgrade(Cards.upgrades.token.shield)])
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // the attack target
    await g.chooseBaseAsync(1, 2); // the On Attack's base

    expect(g.state.player2.base.damage).toBe(4); // 2 from the ability + 2 combat
  });

  it("'a base' means either — it can hit your own", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.yellowAcesBomber)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [ownUpgrade(Cards.upgrades.token.shield)])
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseBaseAsync(1, 1); // …your own base

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(2); // combat damage only
  });

  it("does nothing when it is not upgraded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.ash.yellowAcesBomber).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    const res = await g.chooseBaseAsync(1, 2);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(2);
  });
});
