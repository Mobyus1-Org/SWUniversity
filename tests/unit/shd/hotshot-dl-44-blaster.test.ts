import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_174 Hotshot DL-44 Blaster (Upgrade, +2/+0) — "Attach to a non-VEHICLE unit.  Smuggle
// [3 resources, Cunning].  When played using Smuggle: Attack with attached unit."
//
// The attach restriction and the Smuggle cost were already wired; the smuggle-triggered attack
// was not. It fires ONLY on a Smuggle play — a normal hand play just attaches.

const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 Ground, non-Vehicle
const AWING = Cards.units.jtl.phoenixSquadronAWing; // 3/2 Space VEHICLE — an illegal target

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, MARINE);
}

describe("SHD_174 Hotshot DL-44 Blaster", () => {
  it("attacks with the attached unit when played using Smuggle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.upgrades.shd.hotshotBlaster, 1) // resource 0 = the Blaster
        .FillResourcesForPlayer(1, MARINE, 8)                            // to pay the smuggle cost
        .Build(),
    );

    await g.smuggleResourceAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attach to the Marine
    await g.chooseBaseAsync(1, 2);       // the granted attack picks a target

    // 3 printed + 2 from the Blaster.
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.groundArena[0].upgrades.some(
      u => u.cardId === Cards.upgrades.shd.hotshotBlaster,
    )).toBe(true);
  });

  it("does NOT attack when played normally from hand (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, MARINE, 8)
        .WithCardInHandForPlayer(1, Cards.upgrades.shd.hotshotBlaster)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.groundArena[0].upgrades.some(
      u => u.cardId === Cards.upgrades.shd.hotshotBlaster,
    )).toBe(true);
  });

  it("cannot attach to a Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, AWING)
        .FillResourcesForPlayer(1, MARINE, 8)
        .WithCardInHandForPlayer(1, Cards.upgrades.shd.hotshotBlaster)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();

    const vehicle = g.state.player1.spaceArena[0];
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [vehicle.playId] });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);

    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(1);
  });

  it("the smuggled attack uses the boosted power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(1, Cards.upgrades.shd.hotshotBlaster, 1)
        .FillResourcesForPlayer(1, MARINE, 8)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.smuggleResourceAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(5); // 3 + 2, not 3
  });
});
