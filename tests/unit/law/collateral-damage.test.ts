import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_208 Collateral Damage (Event, cost 3) —
// "Deal 2 damage to a unit. Then, deal 2 damage to a base or another unit in the same arena."
function setup() {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.law.collateralDamage)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .Build(),
  );
  return g;
}

describe("LAW_208 Collateral Damage", () => {
  it("deals 2 damage to the first chosen unit", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("then deals 2 damage to another unit in the same arena", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(2, 1);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[1].damage).toBe(2);
  });

  it("can send the second 2 damage to a base instead", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(2);
  });

  // The second damage is mandatory ("Then, deal…"), unlike SEC_180's "you may deal…".
  it("prompts for the second target rather than offering a skip", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  // "another unit in the same arena" — not the first target, not the other arena. A base is
  // always eligible regardless of arena.
  it("offers other same-arena units and both bases, but not the first target", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0);

    const resolution = res.lastDispatchResponse?.resolutionNeeded;
    const target = resolution?.type === "Target" ? resolution : undefined;
    const offered = target?.fromPlayIds ?? [];

    expect(offered).not.toContain(g.state.player2.groundArena[0].playId);
    expect(offered).not.toContain(g.state.player2.spaceArena[0].playId);
    expect(offered).toContain(g.state.player2.groundArena[1].playId);
    expect(target?.fromZones).toContain("Base");
  });
});
