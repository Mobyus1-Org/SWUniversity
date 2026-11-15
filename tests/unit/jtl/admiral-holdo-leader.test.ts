import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_007 Admiral Holdo — We're Not Alone (leader; 3/8 Ground deployed, Command/Heroism)
//   Front: "Action [1 resource, Exhaust]: Give a Resistance unit or a unit with a Resistance
//           upgrade on it +2/+2 for this phase."
//   Deployed: "On Attack: You may give ANOTHER Resistance unit or a unit with a Resistance upgrade
//             on it +2/+2 for this phase."
//
// "A unit" is unqualified — either side's. A unit counts through its own trait OR through a
// Resistance upgrade (a Resistance pilot) riding it.

const HOLDO = Cards.leaders.jtl.admiralHoldo;
const RESISTANCE = Cards.units.sec.craitVeteran; // 4/3 Resistance, no text
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Rebel — not Resistance
const XWING = Cards.units.token.xWing;            // 2/2 Rebel Fighter
const JAREK = Cards.upgrades.jtl.jarekYeager;    // Resistance pilot

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });
const stats = (u: Parameters<typeof Unit.FromInterface>[0]) => [Unit.FromInterface(u).CurrentPower(), Unit.FromInterface(u).TotalHP()];

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(HOLDO)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithActivePlayer(1);
}

describe("JTL_007 Admiral Holdo — leader Action", () => {
  it("gives a Resistance unit +2/+2 for this phase, paying 1 and exhausting Holdo", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, RESISTANCE).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(stats(g.state.player1.groundArena[0])).toEqual([6, 5]);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(1);
  });

  it("a unit with a Resistance upgrade on it qualifies; a plain Rebel does not", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithSpaceUnitForPlayer(1, XWING)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [up(JAREK, 1)])
        .WithGroundUnitForPlayer(1, MARINE)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    expect(stats(g.state.player1.groundArena[0])).toEqual([3, 3]); // refused

    const [powerBefore, hpBefore] = stats(g.state.player1.spaceArena[0]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.spaceArena[0].playId] });
    expect(stats(g.state.player1.spaceArena[0])).toEqual([powerBefore + 2, hpBefore + 2]);
  });

  it("can target an ENEMY Resistance unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, RESISTANCE).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(stats(g.state.player2.groundArena[0])).toEqual([6, 5]);
  });

  it("with no qualifying unit, still pays its cost and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.leader.ready).toBe(false);
    expect(stats(g.state.player1.groundArena[0])).toEqual([3, 3]);
  });
});

describe("JTL_007 Admiral Holdo — deployed On Attack", () => {
  function deployed() {
    return setup()
      .MyLeader(HOLDO, true, true)
      .WithGroundUnitForPlayer(1, HOLDO)
      .WithGroundUnitForPlayer(1, RESISTANCE);
  }

  it("may give another Resistance unit +2/+2 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[1].playId] });

    expect(stats(g.state.player1.groundArena[1])).toEqual([6, 5]);
    expect(g.state.player2.base.damage).toBe(3); // the attack still lands
  });

  it("can be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(stats(g.state.player1.groundArena[1])).toEqual([4, 3]);
  });

  it("asks nothing when the only Resistance unit is Holdo herself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().MyLeader(HOLDO, true, true).WithGroundUnitForPlayer(1, HOLDO).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(3);
  });
});
