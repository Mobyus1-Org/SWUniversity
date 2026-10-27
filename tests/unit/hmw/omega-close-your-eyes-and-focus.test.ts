import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasGrit } from "@/server/engine/card-db/keyword-dictionaries.ts/grit";
import { NeedsTarget } from "@/lib/engine/message-types";

// HMW_006 Omega — Close Your Eyes and Focus (Leader, Vigilance/Heroism, Clone; unit 2/7 Ground)
// Front:    Action [1 resource, Exhaust]: Attack with a Heroism unit. It gains Grit for this attack.
//           (It gets +1/+0 for each damage on it.)
//           Epic Action: If you control 5 or more resources, deploy this leader.
// Deployed: Other friendly Heroism units gain Grit.
//
// The resource is a COST; having a Heroism unit able to attack is not, so the Action is usable
// (and pays) on a board with no such unit — it just does nothing.
//
// Fixtures, all vanilla:
//   Battlefield Marine      (SOR_095) 3/3 Ground, Command/Heroism
//   Phoenix Squadron A-Wing (JTL_095) 3/2 Space,  Command/Heroism
//   Underworld Thug         (SHD_257) 2/3 Ground, no aspects
const OMEGA = Cards.leaders.hmw.omega;
const MARINE = Cards.units.sor.battlefieldMarine;
const AWING = Cards.units.jtl.phoenixSquadronAWing;
const THUG = Cards.units.shd.underworldThug;

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(OMEGA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
}

/** Omega already deployed, as a unit in P1's ground arena (index 0). */
function deployedSetup() {
  return setup().MyLeader(OMEGA, true, true, true).WithGroundUnitForPlayer(1, OMEGA);
}

const useOmega = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: OMEGA });
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const offered = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as NeedsTarget | undefined)?.fromPlayIds;
const grit = (g: GameTestAdapter, p: 1 | 2, arena: "groundArena" | "spaceArena", i: number) => {
  const u = g.state[p === 1 ? "player1" : "player2"][arena][i];
  return HasGrit(u.cardId, u.playId, p);
};

describe("HMW_006 Omega — front Action", () => {
  it("offers only friendly Heroism units, in both arenas", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, THUG)
        .WithSpaceUnitForPlayer(1, AWING)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await useOmega(g);

    expect(offered(g)?.slice().sort()).toEqual([
      g.state.player1.groundArena[0].playId,
      g.state.player1.spaceArena[0].playId,
    ].sort());
  });

  it("pays 1 resource and exhausts Omega", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());
    const before = readyResources(g);

    await useOmega(g);

    expect(readyResources(g)).toBe(before - 1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("the attacker gains Grit for the attack: +1/+0 per damage on it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, true, 2).Build()); // 2 damage

    await useOmega(g);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 power + 2 Grit
  });

  it("the Grit lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, true, 2).Build());

    await useOmega(g);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(grit(g, 1, "groundArena", 0)).toBe(false);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });

  it("with no Heroism unit able to attack it is still usable — it pays, exhausts and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, THUG).Build());
    const before = readyResources(g);

    await useOmega(g);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(before - 1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("is not available with no ready resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(0).WithGroundUnitForPlayer(1, MARINE).Build());

    await useOmega(g);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("Epic Action: deploys with 5 resources, not with 4", async () => {
    const g5 = new GameTestAdapter();
    g5.loadNewState(setup(5).Build());
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(true);

    const g4 = new GameTestAdapter();
    g4.loadNewState(setup(4).Build());
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);
  });
});

describe("HMW_006 Omega — deployed: other friendly Heroism units gain Grit", () => {
  it("friendly Heroism units in both arenas gain Grit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedSetup()
        .WithGroundUnitForPlayer(1, MARINE, true, 2)
        .WithSpaceUnitForPlayer(1, AWING)
        .Build(),
    );

    expect(grit(g, 1, "groundArena", 1)).toBe(true);
    expect(grit(g, 1, "spaceArena", 0)).toBe(true);
    expect(Unit.FromInterface(g.state.player1.groundArena[1]).CurrentPower()).toBe(5); // 3 + 2 damage
  });

  it("non-Heroism friendly units, enemy Heroism units and Omega herself do not", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .MyLeader(OMEGA, true, true, true)
        .WithGroundUnitForPlayer(1, OMEGA, true, 3)
        .WithGroundUnitForPlayer(1, THUG, true, 2)
        .WithGroundUnitForPlayer(2, MARINE, true, 1)
        .Build(),
    );

    expect(grit(g, 1, "groundArena", 0)).toBe(false); // "Other"
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(2);
    expect(grit(g, 1, "groundArena", 1)).toBe(false); // not Heroism
    expect(grit(g, 2, "groundArena", 0)).toBe(false); // not friendly
  });

  it("a friendly Heroism unit that can't gain abilities (Imprisoned) does not gain Grit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedSetup()
        .WithGroundUnitForPlayer(1, MARINE, true, 2)
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [GameStateBuilder.Upgrade(Cards.upgrades.shd.imprisoned, 2)])
        .Build(),
    );

    expect(grit(g, 1, "groundArena", 1)).toBe(false);
  });

  it("control: without Omega deployed, a Heroism unit has no Grit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, true, 2).Build());

    expect(grit(g, 1, "groundArena", 0)).toBe(false);
  });
});
