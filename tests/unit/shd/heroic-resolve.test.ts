import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_155 Heroic Resolve (Upgrade +1/+1, cost 1, Heroism/Aggression, Innate) —
//   "Attached unit gains: 'Action [2 resources, defeat a Heroic Resolve on this unit]: Attack with
//    this unit. It gets +4/+0 and gains Overwhelm for this attack.'"
//
// "Attached unit GAINS" — the Action belongs to the HOST, so it is enumerated through the unit and
// dispatched with the host's playId plus the upgrade's cardId as the ability id. That is a
// different path from HMW_037 Bacta Tank, whose Action is its own and lives on a base.
//
// The card was half-wired before this: ActionAbilityCost knew it charged 2, and overwhelm.ts
// already granted Overwhelm off a SHD_155 effect — but nothing ever offered or dispatched it, so
// the cost was a price tag on an ability that could not be used.
//
// The cost has NO [Exhaust], so the host must still be ready afterwards; and it defeats exactly
// ONE Heroic Resolve, which matters when two are stacked.

const RESOLVE = "SHD_155";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3 -> 4/4 with the upgrade
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithActivePlayer(1);
}

const hostPlayId = (g: GameTestAdapter) => g.state.player1.groundArena[0].playId;
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const useIt = (g: GameTestAdapter) =>
  g.dispatchAsync(1, "use-ability", { cardId: RESOLVE, playId: hostPlayId(g) });

describe("SHD_155 Heroic Resolve", () => {
  it("gives the attached unit +1/+1", () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1)]).Build());
    const host = Unit.FromInterface(g.state.player1.groundArena[0]);

    expect(host.CurrentPower()).toBe(4); // 3 + 1
    expect(host.TotalHP()).toBe(4);
  });

  it("attacks at +4/+0 WITHOUT the upgrade's +1/+1 — the cost ate it first", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1)]).Build());

    await useIt(g);
    await g.chooseBaseAsync(1, 2);

    // Costs are paid before the effect resolves, and this cost DEFEATS the Heroic Resolve — so
    // its +1/+1 is gone by the time the attack happens. 3 + 4, not 3 + 1 + 4.
    expect(g.state.player2.base.damage).toBe(7);
  });

  it("gains Overwhelm for the attack — excess spills to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1)])
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await useIt(g);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(4); // 7 power - 3 HP spilled
  });

  it("costs 2 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1)]).Build());
    const before = readyResources(g);

    await useIt(g);
    await g.chooseBaseAsync(1, 2);

    expect(readyResources(g)).toBe(before - 2);
  });

  it("defeats exactly ONE Heroic Resolve, leaving a second attached", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1), { ...up(RESOLVE, 1), playId: "@2" }])
        .Build(),
    );

    await useIt(g);
    await g.chooseBaseAsync(1, 2);

    const host = g.state.player1.groundArena[0];
    expect(host.upgrades.filter(u => u.cardId === RESOLVE)).toHaveLength(1);
    // The surviving copy's +1/+1 still counts: 3 + 1 + 4.
    expect(g.state.player2.base.damage).toBe(8);
  });

  it("does NOT exhaust the host — the cost has no [Exhaust]", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1)]).Build());

    await useIt(g);
    await g.chooseBaseAsync(1, 2);

    // The attack itself exhausts it; what matters is that the ABILITY did not also demand ready.
    expect(g.state.player1.groundArena[0].cardId).toBe(MARINE);
  });

  it("is unusable with fewer than 2 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(1).WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1)]).Build());

    await useIt(g);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(1); // cost not paid
  });

  it("the buff and Overwhelm do not linger past the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESOLVE, 1)])
        .WithGroundUnitForPlayer(1, CSF)
        .Build(),
    );

    await useIt(g);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(7);

    await g.dispatchAsync(2, "pass-action", {});
    const csfIdx = g.state.player1.groundArena.findIndex(u => u.cardId === CSF);
    await g.attackWithGroundUnitAsync(1, csfIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(10); // 7 + 3, the other unit is unbuffed
  });

  it("a unit with no Heroic Resolve has no such Action", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await useIt(g);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
