import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

// HMW_012 Poggle the Lesser — Let the Executions Begin (Leader, Aggression/Villainy, Separatist
// Official; unit 1/6 Ground)
// Front:    Action [1 resource, Exhaust]: Ready a friendly Creature unit and deal 1 damage to it.
//           Epic Action: If you control 5 or more resources, deploy this leader.
// Deployed: When Deployed: Create a Beast token.
//           On Attack: You may ready a friendly Creature unit and deal 1 damage to it.
//
// The resource is the Action's cost; a friendly Creature is a target, not a cost, so the Action is
// usable with none (it pays, exhausts and does nothing).
//
// Fixtures:
//   Filthy Dianoga     (HMW_155) 5/5 Ground Creature, vanilla
//   Beast token        (HMW_T03) 3/3 Ground Creature
//   Battlefield Marine (SOR_095) 3/3 — not a Creature
const POGGLE = Cards.leaders.hmw.poggleTheLesser;
const DIANOGA = Cards.units.hmw.filthyDianoga;
const BEAST = Cards.units.token.beast;
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(resources = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(POGGLE)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
}

/** Poggle already deployed, as a unit in P1's ground arena (index 0). */
function deployedSetup() {
  return setup().MyLeader(POGGLE, true, true, true).WithGroundUnitForPlayer(1, POGGLE);
}

const usePoggle = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: POGGLE });
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const offered = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as NeedsTarget | undefined)?.fromPlayIds;
const mine = (g: GameTestAdapter, cardId: string) => g.state.player1.groundArena.filter(u => u.cardId === cardId);

describe("HMW_012 Poggle the Lesser — front Action", () => {
  it("offers only friendly Creature units, ready or exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, DIANOGA, false) // exhausted
        .WithGroundUnitForPlayer(1, BEAST)          // ready — still a legal choice
        .WithGroundUnitForPlayer(1, MARINE, false)  // not a Creature
        .WithGroundUnitForPlayer(2, DIANOGA, false) // enemy Creature
        .Build(),
    );

    await usePoggle(g);

    expect(offered(g)?.slice().sort()).toEqual([
      g.state.player1.groundArena[0].playId,
      g.state.player1.groundArena[1].playId,
    ].sort());
  });

  it("readies the chosen Creature and deals 1 damage to it; pays 1 and exhausts Poggle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, DIANOGA, false).Build());
    const before = readyResources(g);

    await usePoggle(g);
    await g.chooseGroundUnitAsync(1, 0);

    const dianoga = mine(g, DIANOGA)[0];
    expect(dianoga.ready).toBe(true);
    expect(dianoga.damage).toBe(1);
    expect(readyResources(g)).toBe(before - 1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("a Creature with 1 HP left is defeated by the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, DIANOGA, false, 4).Build());

    await usePoggle(g);
    await g.chooseGroundUnitAsync(1, 0);

    expect(mine(g, DIANOGA)).toHaveLength(0);
    expect(g.state.player1.discard.some(c => c.cardId === DIANOGA)).toBe(true);
  });

  it("with no friendly Creature it is still usable — it pays, exhausts and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE, false).Build());
    const before = readyResources(g);

    await usePoggle(g);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(readyResources(g)).toBe(before - 1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(mine(g, MARINE)[0].ready).toBe(false);
  });

  it("is not available with no ready resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(0).WithGroundUnitForPlayer(1, DIANOGA, false).Build());

    await usePoggle(g);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(mine(g, DIANOGA)[0].ready).toBe(false);
  });
});

describe("HMW_012 Poggle the Lesser — Epic Action and When Deployed", () => {
  it("deploys with 5 resources (not 4) and creates exactly one Beast token", async () => {
    const g4 = new GameTestAdapter();
    g4.loadNewState(setup(4).Build());
    await g4.deployLeaderAsync(1);
    expect(g4.state.player1.leader.deployed).toBe(false);

    const g = new GameTestAdapter();
    g.loadNewState(setup(5).Build());
    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    const beasts = mine(g, BEAST);
    expect(beasts).toHaveLength(1);
    expect(beasts[0].ready).toBe(false); // tokens enter play exhausted
  });
});

describe("HMW_012 Poggle the Lesser — deployed On Attack", () => {
  it("may ready a friendly Creature and deal 1 damage to it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().WithGroundUnitForPlayer(1, DIANOGA, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1);

    const dianoga = mine(g, DIANOGA)[0];
    expect(dianoga.ready).toBe(true);
    expect(dianoga.damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(1); // Poggle's 1 power still lands
  });

  it("may be declined: nothing readied or damaged, and the attack still hits", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().WithGroundUnitForPlayer(1, DIANOGA, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    const dianoga = mine(g, DIANOGA)[0];
    expect(dianoga.ready).toBe(false);
    expect(dianoga.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("is skipped silently with no friendly Creature", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().WithGroundUnitForPlayer(1, MARINE, false).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(1);
  });
});
