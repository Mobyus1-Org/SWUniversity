import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { CardInPlay } from "@/lib/engine/core-models";
import { PilotingEligibleVehicles, PilotlessVehiclePlayIds } from "@/server/engine/card-db/upgrade-attach-restrictions";

// JTL_013 Poe Dameron — I Can Fly Anything (leader; as an upgrade: +2/+1)
// "Action [1 resource, Exhaust]: Flip this leader and attach him as an upgrade to a friendly
//  Vehicle unit without a Pilot on it."
// Note he ATTACHES — he does not play or deploy — so the extra Pilot slots granted by the
// Millennium Falcon and R2-D2 (which say "play or deploy") never make him a legal attacher.

function upg(cardId: string): CardInPlay {
  return { cardId, playId: "@", owner: 1, controller: 1 };
}

const CRAFT = Cards.units.sor.systemPatrolCraft; // ordinary Vehicle
const FALCON = Cards.units.jtl.millenniumFalcon;
const ANAKIN = Cards.units.jtl.anakinSkywalker;

function setup(build: (b: GameStateBuilder) => GameStateBuilder) {
  return build(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.jtl.poeDameron)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12),
  ).Build();
}

describe("JTL_013 Poe Dameron (leader) — Action: flip and attach", () => {
  it("flips the leader and attaches him to a pilotless Vehicle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b.WithSpaceUnitForPlayer(1, CRAFT)));

    await g.useLeaderAbilityAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    const craft = g.state.player1.spaceArena[0];
    expect(craft.upgrades.map(u => u.cardId)).toContain(Cards.leaders.jtl.poeDameron);
    // He is flipped: the leader is deployed (as the upgrade), and it points at that upgrade.
    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.leader.deployedPlayId).toBe(craft.upgrades[0].playId);
    // The 1-resource cost was paid and the leader exhausted to pay it.
    expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(11); // 12 - 1
  });

  it("gives the attached Vehicle +2/+1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b.WithSpaceUnitForPlayer(1, CRAFT)));

    await g.useLeaderAbilityAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    const craft = Unit.FromInterface(g.state.player1.spaceArena[0]);
    expect(craft.CurrentPower()).toBe(5); // 3 + 2
    expect(craft.TotalHP()).toBe(5); // 4 + 1
  });

  it("cannot attach to a Vehicle that already has a Pilot", async () => {
    const g = new GameTestAdapter();
    // Ordinary Vehicle already piloted by Anakin — no pilotless Vehicle anywhere.
    g.loadNewState(setup(b => b
      .WithSpaceUnitForPlayer(1, CRAFT)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upg(ANAKIN)])));

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.deployed).toBe(false); // he stays a leader
    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(1);
  });

  it("cannot attach to a Falcon that has a free Pilot slot but is already piloted", async () => {
    const g = new GameTestAdapter();
    // The Falcon takes 2 Pilots and carries only 1 — a PLAY or DEPLOY could add another, but
    // Poe ATTACHES, and his text requires a Vehicle "without a Pilot on it".
    g.loadNewState(setup(b => b
      .WithSpaceUnitForPlayer(1, FALCON)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upg(ANAKIN)])));

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.deployed).toBe(false);
    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(1); // Anakin only
  });

  it("cannot attach to a non-Vehicle unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b.WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)));

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.deployed).toBe(false);
  });

  it("once attached, the Vehicle counts as piloted — no further Pilot may be played on it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(b => b.WithSpaceUnitForPlayer(1, CRAFT)));

    await g.useLeaderAbilityAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    // Poe occupies the craft's only Pilot slot, so no further Pilot may be played or deployed
    // onto it, and it is no longer a legal attach target either.
    expect(PilotingEligibleVehicles(g.state, 1, ANAKIN)).toHaveLength(0);
    expect(PilotlessVehiclePlayIds(g.state, 1)).toHaveLength(0);
  });
});
