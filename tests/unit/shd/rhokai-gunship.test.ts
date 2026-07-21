import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_164 Rhokai Gunship (2/1 Space, cost 2)
// "When Defeated: Deal 1 damage to a unit or base."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("SHD_164 Rhokai Gunship", () => {
  it("deals 1 damage to a chosen unit when defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.shd.rhokaiGunship) // 2/1 — dies to any counter-damage
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0); // 4 counter-damage defeats the Gunship
    await g.chooseSpaceUnitAsync(2, 0); // When Defeated target

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(3); // 2 from the attack + 1 from When Defeated
  });

  it("can deal its 1 damage to a base instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.shd.rhokaiGunship)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player2.spaceArena[0].damage).toBe(2); // only the attack damage
  });

  it("offers both bases and every unit as targets", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.shd.rhokaiGunship)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[]; fromZones?: string[] };
    expect(res.fromZones).toContain("Base");
    expect(res.fromPlayIds).toContain(g.state.player2.spaceArena[0].playId);
    expect(res.fromPlayIds).toContain(g.state.player1.groundArena[0].playId); // friendly units too
  });
});
