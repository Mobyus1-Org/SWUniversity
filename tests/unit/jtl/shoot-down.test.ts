import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_176 Shoot Down (Event, cost 2, Aggression)
//   "Deal 3 damage to a space unit. If that unit is defeated this way, you may deal 2 damage to a base."

const AWING = Cards.units.jtl.phoenixSquadronAWing;  // 3/2 Space
const WAYFARER = Cards.units.lof.hyperspaceWayfarer; // 4/10 Space
const MARINE = Cards.units.sor.battlefieldMarine;    // Ground

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, Cards.events.jtl.shootDown);
}

const offer = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] })?.fromPlayIds ?? [];

describe("JTL_176 Shoot Down", () => {
  it("defeating the unit offers 2 damage to a base — the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, AWING).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.state.player2.spaceArena).toHaveLength(0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("either base may be chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, AWING).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("declining the base damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, AWING).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("a survivor gets no base offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, WAYFARER).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(3);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("a Shield absorbs it — not defeated, so no base offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithSpaceUnitForPlayer(2, AWING)
      .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 2)])
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("offers space units on either side, not ground units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithSpaceUnitForPlayer(1, AWING)
      .WithSpaceUnitForPlayer(2, AWING)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect([...offer(g)].sort()).toEqual([g.state.player1.spaceArena[0].playId, g.state.player2.spaceArena[0].playId].sort());
  });
});
