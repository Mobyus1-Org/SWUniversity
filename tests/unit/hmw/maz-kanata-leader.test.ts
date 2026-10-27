import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { NeedsTarget } from "@/lib/engine/message-types";

// HMW_002 Maz Kanata — Eclectic Pirate Queen (Leader, Command/Cunning, Underworld; unit 4/4 Ground)
// Front:    Action [Exhaust]: Play a Fringe or Underworld unit from your hand. It costs 1 resource
//           less. Give a Weakness token to it.
//           Epic Action: If you control 6 or more resources, deploy this leader.
// Deployed: Hidden
//           Action: Play a Fringe or Underworld unit from your hand. It costs 1 resource less. Give
//           a Weakness token to it.   (no Exhaust — usable again and again)
//
// Fixtures under a Cunning base, Maz supplying Command + Cunning:
//   Underworld Thug      (SHD_257) cost 2, 2/3, no aspects, Underworld — prices at 2, so 1 via Maz
//   Swoop Racer          (SOR_210) cost 3, 4/3, Cunning, Fringe          — 3, so 2 via Maz
//   Contraband Starhopper(SEC_161) cost 2, 2/3 Space, Aggression, Underworld — 2 + 2 penalty = 4,
//                                  so 3 via Maz: the discount comes off AFTER the penalty
//   Reckless Gunslinger  (SHD_160) cost 1, 2/1, Aggression, Underworld — "When Played: Deal 1
//                                  damage to each base." 1 HP, so the Weakness kills it
//   Battlefield Marine   — Rebel/Trooper, neither Fringe nor Underworld
const MAZ = Cards.leaders.hmw.mazKanata;
const UNDERWORLD = Cards.units.shd.underworldThug;
const FRINGE = Cards.units.sor.swoopRacer;
const OFF_ASPECT = Cards.units.sec.contrabandStarhopper;
const GUNSLINGER = Cards.units.shd.recklessGunslinger;
const MARINE = Cards.units.sor.battlefieldMarine;
const EVENT = Cards.events.sor.strikeTrue;
const WEAKNESS = Cards.units.token.weakness;

function setup(hand: string[], resources = 10) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP) // Cunning
    .MyLeader(MAZ)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithActivePlayer(1);
  for (const c of hand) b = b.WithCardInHandForPlayer(1, c);
  return b;
}

/** Maz already deployed, as a unit in P1's ground arena. */
function deployedSetup(hand: string[], resources = 10) {
  return setup(hand, resources).MyLeader(MAZ, true, true, true).WithGroundUnitForPlayer(1, MAZ);
}

const useMaz = (g: GameTestAdapter) => g.dispatchAsync(1, "use-ability", { cardId: MAZ });
const useMazUnit = (g: GameTestAdapter) => {
  const maz = g.state.player1.groundArena.find(u => u.cardId === MAZ)!;
  return g.dispatchAsync(1, "use-ability", { cardId: MAZ, playId: maz.playId });
};
const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;
const handIndices = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as NeedsTarget | undefined)?.fromIndices;
const unitOf = (g: GameTestAdapter, cardId: string) =>
  [...g.state.player1.groundArena, ...g.state.player1.spaceArena].find(u => u.cardId === cardId);

describe("HMW_002 Maz Kanata — front Action", () => {
  it("offers only Fringe or Underworld units — not events, not other units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([EVENT, MARINE, UNDERWORLD, FRINGE]).Build());

    await useMaz(g);

    expect(handIndices(g)).toEqual([2, 3]);
  });

  it("plays the unit for 1 less and gives it a Weakness token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([FRINGE]).Build());
    const before = readyResources(g);

    await useMaz(g);
    await g.chooseCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(before - 2); // Swoop Racer costs 3
    const racer = unitOf(g, FRINGE)!;
    expect(racer.upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
    const unit = Unit.FromInterface(racer);
    expect(unit.CurrentPower()).toBe(3); // 4/3 − 1/1
    expect(unit.TotalHP()).toBe(2);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust is the cost
  });

  it("an Underworld unit qualifies too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([UNDERWORLD]).Build());
    const before = readyResources(g);

    await useMaz(g);
    await g.chooseCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(before - 1); // Underworld Thug costs 2
    expect(unitOf(g, UNDERWORLD)!.upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
  });

  it("the discount comes off after the aspect penalty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([OFF_ASPECT]).Build());
    const before = readyResources(g);

    await useMaz(g);
    await g.chooseCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(before - 3); // 2 + 2 Aggression penalty − 1
    expect(unitOf(g, OFF_ASPECT)).toBeDefined();
  });

  it("rejects a non-qualifying unit named directly", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([FRINGE, MARINE]).Build());
    const before = readyResources(g);

    await useMaz(g);
    await g.chooseCardFromHandAsync(1, 1); // the Marine

    expect(unitOf(g, MARINE)).toBeUndefined();
    expect(g.state.player1.hand).toHaveLength(2);
    expect(readyResources(g)).toBe(before);
  });

  it("a 1-HP unit dies to the Weakness but its When Played still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([GUNSLINGER]).Build());
    const before = readyResources(g);

    await useMaz(g);
    await g.chooseCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(before - 2); // 1 + 2 Aggression penalty − 1
    expect(unitOf(g, GUNSLINGER)).toBeUndefined();
    expect(g.state.player1.discard.some(c => c.cardId === GUNSLINGER)).toBe(true);
    expect(g.state.player1.base.damage).toBe(1); // When Played: 1 damage to each base
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("is not offered when the only qualifying unit is unaffordable even after the discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([FRINGE], 1).Build()); // Swoop Racer still needs 2

    await useMaz(g);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("is not offered with only non-qualifying cards in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([EVENT, MARINE]).Build());

    await useMaz(g);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("control: playing a Fringe unit normally gets no discount and no Weakness", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([FRINGE]).Build());
    const before = readyResources(g);

    await g.playCardFromHandAsync(1, 0);

    expect(readyResources(g)).toBe(before - 3);
    expect(unitOf(g, FRINGE)!.upgrades).toHaveLength(0);
  });
});

describe("HMW_002 Maz Kanata — Epic Action", () => {
  it("deploys with 6 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([], 6).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(unitOf(g, MAZ)).toBeDefined();
  });

  it("does not deploy with 5 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup([], 5).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });
});

describe("HMW_002 Maz Kanata — deployed side", () => {
  it("has Hidden", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup([]).Build());
    const maz = unitOf(g, MAZ)!;

    expect(HasHidden(maz.cardId, maz.playId, 1)).toBe(true);
  });

  it("can't be attacked the phase she was deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup([], 6)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.attackWithGroundUnitAsync(2, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds).not.toContain(unitOf(g, MAZ)!.playId);
    expect(target.fromPlayIds).toHaveLength(1);
  });

  it("plays at 1 less with a Weakness token and does NOT exhaust Maz — usable twice", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup([FRINGE, UNDERWORLD]).Build());
    const before = readyResources(g);

    await useMazUnit(g);
    await g.chooseCardFromHandAsync(1, 0); // Swoop Racer for 2
    expect(unitOf(g, MAZ)!.ready).toBe(true);
    await g.dispatchAsync(2, "pass-action", {});
    await useMazUnit(g);
    await g.chooseCardFromHandAsync(1, 0); // Underworld Thug for 1

    expect(readyResources(g)).toBe(before - 3);
    expect(unitOf(g, FRINGE)!.upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
    expect(unitOf(g, UNDERWORLD)!.upgrades.map(u => u.cardId)).toEqual([WEAKNESS]);
    expect(unitOf(g, MAZ)!.ready).toBe(true);
  });

  it("offers only Fringe or Underworld units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup([MARINE, EVENT, FRINGE]).Build());

    await useMazUnit(g);

    expect(handIndices(g)).toEqual([2]);
  });

  it("is not offered with no qualifying unit in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup([MARINE]).Build());

    await useMazUnit(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidReason ?? "").toMatch(/no available action/);
    expect(unitOf(g, MARINE)).toBeUndefined();
  });

  it("is not offered when the qualifying unit is unaffordable even after the discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup([FRINGE], 1).Build());

    await useMazUnit(g);

    expect(g.lastDispatchResponse?.invalidReason ?? "").toMatch(/no available action/);
    expect(unitOf(g, FRINGE)).toBeUndefined();
  });
});
