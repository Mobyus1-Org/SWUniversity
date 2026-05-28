import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

function falcon(g: GameTestAdapter) {
  return Unit.FromInterface(g.state.player1.spaceArena[0]);
}

// Falcon (JTL_249): base power 3, HP 4, cost 3, Ambush, Space/Vehicle/Transport/Rebel.
// Ability: "+1/+0 for each Pilot on it" (detected by Pilot trait on upgrade).
// Pilot upgrade powers (CardUpgradePower): Luke=3, Snap=2, R2-D2(JTL_245)=1, Poe leader=2.
// Expected power = 3 (base) + sum(CardUpgradePower) + pilotCount (ability).

describe("JTL_249 Millennium Falcon — +1/+0 per Pilot", () => {
  it("has base power 3 with no pilots aboard", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .Build(),
    );
    expect(falcon(g).CurrentPower()).toBe(3);
  });

  it("gets +1 for 1 Pilot aboard (Luke, upgradePower=3): 3+3+1=7", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
        ])
        .Build(),
    );
    expect(falcon(g).CurrentPower()).toBe(7);
  });

  it("gets +2 for 2 Pilots aboard (Luke+Snap, upgradePower=3+2): 3+3+2+2=10", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
          GameStateBuilder.Upgrade(Cards.units.jtl.snapWexley, 1),
        ])
        .Build(),
    );
    expect(falcon(g).CurrentPower()).toBe(10);
  });

  it("counts R2-D2 (JTL_245, upgradePower=1) as a Pilot: 3+1+1=5", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.r2d2, 1),
        ])
        .Build(),
    );
    expect(falcon(g).CurrentPower()).toBe(5);
  });

  it("counts Poe Dameron leader (JTL_013, upgradePower=2) as a Pilot: 3+2+1=6", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.poeDameron)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.leaders.jtl.poeDameron, 1),
        ])
        .Build(),
    );
    expect(falcon(g).CurrentPower()).toBe(6);
  });

  it("does not count non-Pilot upgrades (Shield token): stays at 3", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
        ])
        .Build(),
    );
    expect(falcon(g).CurrentPower()).toBe(3);
  });

  it("suppresses the +1/+0 bonus when abilities are lost (Imprisoned): 3+3+0=6, not 7", () => {
    // Imprisoned makes LostAbilities() true — Falcon's own ability is suppressed.
    // Luke's CardUpgradePower(3) still applies (that's a static upgrade stat, not Falcon's ability).
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
          GameStateBuilder.Upgrade("SHD_072", 2), // Imprisoned — loses all abilities
        ])
        .Build(),
    );
    expect(falcon(g).CurrentPower()).toBe(6); // 7 without Imprisoned, 6 with (ability suppressed)
  });
});
