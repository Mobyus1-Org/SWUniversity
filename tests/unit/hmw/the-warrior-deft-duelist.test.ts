import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasAmbush } from "@/server/engine/card-db/keyword-dictionaries.ts/ambush";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// HMW_018 The Warrior — Deft Duelist (Leader, cost 5, 3/6 Ground, Cunning/Heroism, Tusken)
// Front:  Action [1 resource, Exhaust]: Play a unit with 3 or less power from your hand
//         (paying its cost) and give it Ambush for this phase.
//         Epic Action: If you control 5 or more resources, deploy this leader.
// Deployed: Ambush
//           Raid 1
//
// The restriction is POWER, not cost — the first card in the family to read that way. Fixtures,
// all vanilla, under a Cunning base with The Warrior supplying Cunning + Heroism so each prices
// at its printed cost:
//   Hoth Trooper     (IBH_037) cost 2, 2/3 Ground — power 2, comfortably inside
//   Liberated Slaves (SHD_200) cost 3, 3/5 Ground — power 3 exactly, the boundary
//   Swoop Racer      (SOR_210) cost 3, 4/3 Ground — power 4, one over
const WARRIOR = Cards.leaders.hmw.theWarrior;
const POWER_2 = Cards.units.ibh.hothTrooper;
const POWER_3 = Cards.units.shd.liberatedSlaves;
const POWER_4 = Cards.units.sor.swoopRacer;
const ENEMY = Cards.units.sor.battlefieldMarine; // 3/3 — dies to a 3-power Ambush, counters for 3

function setup(hand: string[], resources = 10) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Administrator's Tower — Cunning
    .MyLeader(WARRIOR)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, ENEMY, resources)
    .WithActivePlayer(1);
  for (const c of hand) b = b.WithCardInHandForPlayer(1, c);
  return b;
}

const useWarrior = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: WARRIOR });
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const handIndices = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as { fromIndices?: number[] } | undefined)?.fromIndices;
const inArena = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.groundArena.some(u => u.cardId === cardId);

describe("HMW_018 The Warrior — front Action", () => {
  it("plays a unit with 3 or less power, paying its cost, and gives it Ambush", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([POWER_3]).WithGroundUnitForPlayer(2, ENEMY).Build());
    const before = readyResources(g);

    await useWarrior(g);
    // 1 resource is the ability's cost and is spent before the hand is offered.
    expect(readyResources(g)).toBe(before - 1);

    await g.chooseCardFromHandAsync(1, 0);
    expect(readyResources(g)).toBe(before - 1 - 3); // Liberated Slaves costs 3

    // Ambush: it may attack an enemy unit immediately.
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0); // 3 power into a 3/3 Marine
    const slaves = g.state.player1.groundArena.find(u => u.cardId === POWER_3)!;
    expect(slaves.damage).toBe(3); // took the counter-attack and survived on 5 HP
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust is part of the cost
  });

  it("the Ambush attack may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([POWER_3]).WithGroundUnitForPlayer(2, ENEMY).Build());

    await useWarrior(g);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // the grant really fired
    await g.chooseNoAsync(1);

    expect(inArena(g, POWER_3)).toBe(true);
    expect(g.state.player2.groundArena).toHaveLength(1); // untouched
    expect(g.state.player1.groundArena.find(u => u.cardId === POWER_3)!.damage).toBe(0);
  });

  it("power 3 is allowed and power 4 is not — the boundary is exact", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([POWER_3, POWER_4]).Build());

    await useWarrior(g);

    // Only the power-3 unit is offered; the power-4 one is filtered out of its own ability.
    expect(handIndices(g)).toEqual([0]);
  });

  it("rejects a power-4 unit even when it is named directly", async () => {
    // The offer filter hides it, but a client could still send it, so the handler must refuse
    // it too. A power-3 unit is in hand as well, so the ability really is available.
    const g = new GameTestAdapter();
    g.loadNewState(setup([POWER_3, POWER_4]).Build());
    const before = readyResources(g);

    await useWarrior(g);
    await g.chooseCardFromHandAsync(1, 1); // the Swoop Racer

    expect(inArena(g, POWER_4)).toBe(false);
    expect(g.state.player1.hand).toHaveLength(2);     // nothing left hand
    expect(readyResources(g)).toBe(before - 1);        // only the ability's own resource went
    expect(g.lastDispatchResponse?.invalidReason ?? "").toMatch(/more than 3 power/);
  });

  it("the Ambush grant lasts the phase but belongs to the played unit alone", async () => {
    // A second unit played normally in the same phase must NOT pick up the grant.
    const g = new GameTestAdapter();
    g.loadNewState(setup([POWER_3, POWER_2]).WithGroundUnitForPlayer(2, ENEMY).Build());

    await useWarrior(g);
    await g.chooseCardFromHandAsync(1, 0); // Liberated Slaves, via The Warrior
    await g.chooseNoAsync(1);              // decline its Ambush
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);   // Hoth Trooper, played normally

    expect(inArena(g, POWER_2)).toBe(true);
    // No Ambush offer for the second unit — it has no grant of its own.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("is not offered when the hand holds only over-powered units", async () => {
    // A hand of nothing but a power-4 unit makes the ability unavailable, so neither the resource
    // nor the Exhaust is paid — the cost is never charged for an ability that cannot be used.
    const g = new GameTestAdapter();
    g.loadNewState(setup([POWER_4]).Build());
    const before = readyResources(g);

    await useWarrior(g);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(readyResources(g)).toBe(before);
    expect(inArena(g, POWER_4)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("is not offered with an empty hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([]).Build());
    const before = readyResources(g);

    await useWarrior(g);

    expect(g.state.player1.leader.ready).toBe(true); // never activated
    expect(readyResources(g)).toBe(before);
  });

  it("is not offered with no ready resource to pay the 1", async () => {
    const g = new GameTestAdapter();
    const state = setup([POWER_2], 0).Build();
    g.loadNewState(state);

    await useWarrior(g);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(inArena(g, POWER_2)).toBe(false);
  });

  it("Epic Action: deploys at 5 resources, refused at 4", async () => {
    const gYes = new GameTestAdapter();
    gYes.loadNewState(setup([], 5).Build());
    await gYes.deployLeaderAsync(1);
    expect(gYes.state.player1.leader.deployed).toBe(true);

    const gNo = new GameTestAdapter();
    gNo.loadNewState(setup([], 4).Build());
    await gNo.deployLeaderAsync(1);
    expect(gNo.state.player1.leader.deployed).toBe(false);
  });
});

describe("HMW_018 The Warrior — deployed side", () => {
  it("has Ambush and Raid 1 printed on the unit side", () => {
    expect(HasAmbush(WARRIOR)).toBe(true);
    expect(RaidAmount(WARRIOR)).toBe(1);
  });

  it("Ambush: deploying her offers an immediate attack on an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([], 5).WithGroundUnitForPlayer(2, ENEMY).Build());

    await g.deployLeaderAsync(1);
    expect(g.state.player1.leader.deployed).toBe(true);

    // 3 power + Raid 1 while attacking = 4 into a 3/3 Marine.
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
    const warrior = g.state.player1.groundArena.find(u => u.cardId === WARRIOR)!;
    expect(warrior.damage).toBe(3); // the Marine countered for 3 into her 6 HP
  });

  it("Ambush on deploy may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([], 5).WithGroundUnitForPlayer(2, ENEMY).Build());

    await g.deployLeaderAsync(1);
    // The offer must really be open, or "declining" it is a silent no-op and this test would
    // pass with the Ambush trigger never queued at all.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena.find(u => u.cardId === WARRIOR)!.damage).toBe(0);
  });

  it("Raid 1: +1/+0 only while attacking", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([], 5)
      .MyLeader(WARRIOR, true, true)
      .WithGroundUnitForPlayer(1, WARRIOR)
      .Build());

    const warrior = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(warrior.CurrentPower(false)).toBe(3); // at rest: printed 3
    expect(warrior.CurrentPower(true)).toBe(4);  // attacking: Raid 1
  });
});
