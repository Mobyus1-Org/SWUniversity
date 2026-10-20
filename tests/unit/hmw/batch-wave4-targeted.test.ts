import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TraitContains } from "@/server/engine/core-functions";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";

// Wave 4 — four cards whose work is choosing targets and applying a measured effect.
//
//   HMW_114 Breach            Event 2  "A friendly unit deals damage equal to its power to an enemy
//                                       unit IN ITS ARENA. If the friendly unit has Overwhelm, deal
//                                       the excess damage to an enemy base."
//   HMW_099 Always a Bigger Fish  Event 2  "Defeat a friendly Creature unit. If you do, play a
//                                       Creature unit that costs up to 3 MORE than the defeated
//                                       unit from your hand for free."
//   HMW_110 Emperor Palpatine  3/2    "When Played: You may take control of an enemy non-leader
//                                       unit that costs 3 or less. If you do, give 2 Weakness
//                                       tokens to it."
//   HMW_134 Zam Wesell         2/4    "Hidden. This unit gains each friendly leader's traits
//                                       except Force, even while she's not in play."
const BREACH = Cards.events.hmw.breach;
const BIGGER_FISH = Cards.events.hmw.alwaysABiggerFish;
const PALPATINE = Cards.units.hmw.emperorPalpatineConsolidating;
const ZAM = Cards.units.hmw.zamWesell;
const WEAKNESS = Cards.units.token.weakness;
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3 Ground, cost 2
const WAMPA = Cards.units.sor.wampa;                  // 4/5 Ground, cost 4, Creature + OVERWHELM
const TURTLE = Cards.units.ash.dinosaurTurtle;        // 7/7 Ground, cost 6, Creature
const SPEEDER = Cards.units.sec.skyhopperCanyonRunner; // 1/4 Ground, cost 1

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Force, Imperial, Sith
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  [...(p === 1 ? g.state.player1 : g.state.player2).groundArena,
   ...(p === 1 ? g.state.player1 : g.state.player2).spaceArena].find(x => x.cardId === cardId)!;

describe("HMW_114 Breach", () => {
  it("a friendly unit deals its power to an enemy unit in its arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, TURTLE)
      .WithCardInHandForPlayer(1, BREACH)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE).playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, TURTLE).playId] });

    expect(find(g, 2, TURTLE).damage).toBe(3); // the Marine's 3 power
  });

  it("only offers enemies in the same arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, TURTLE)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft)
      .WithCardInHandForPlayer(1, BREACH)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE).playId] });

    expect(offered(g)).toEqual([find(g, 2, TURTLE).playId]); // the space unit is out of reach
  });

  it("with Overwhelm, the excess goes to the enemy base", async () => {
    const g = new GameTestAdapter();
    // Wampa has Overwhelm and 4 power into a 1/4 Speeder: 4 kills it exactly, 0 excess…
    // …so use the Speeder's 4 HP against a 7-power Turtle instead for a real spill.
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, WAMPA)
      .WithGroundUnitForPlayer(2, SPEEDER)
      .WithCardInHandForPlayer(1, BREACH)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, WAMPA).playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 2, SPEEDER).playId] });

    // 4 power vs a 4-HP Speeder: it dies with 0 excess, so the base is untouched.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("Overwhelm excess really does spill to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, WAMPA)              // 4 power, Overwhelm
      .WithGroundUnitForPlayer(2, MARINE, true, 1)    // 3/3 with 1 damage: 2 HP left
      .WithCardInHandForPlayer(1, BREACH)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, WAMPA).playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(2); // 4 - 2 remaining HP
  });

  it("without Overwhelm, nothing spills", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, MARINE)             // 3 power, no Overwhelm
      .WithGroundUnitForPlayer(2, SPEEDER, true, 3)   // 1/4 with 3 damage: 1 HP left
      .WithCardInHandForPlayer(1, BREACH)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, MARINE).playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0); // 2 excess, but no Overwhelm
  });
});

describe("HMW_099 Always a Bigger Fish", () => {
  it("defeats a friendly Creature and plays a bigger one free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, WAMPA)              // cost 4 Creature, defeated
      .WithCardInHandForPlayer(1, BIGGER_FISH)
      .WithCardInHandForPlayer(1, TURTLE)             // cost 6 Creature = 4 + 2, within +3
      .Build());
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, WAMPA).playId] });
    // Snapshot AFTER the event's own cost is paid, so the next step measures the free play alone.
    const readyBeforeFreePlay = g.state.player1.resources.filter(r => r.ready).length;
    await g.chooseCardFromHandAsync(1, 0); // the Turtle

    expect(g.state.player1.groundArena.some(x => x.cardId === WAMPA)).toBe(false);
    expect(g.state.player1.groundArena.some(x => x.cardId === TURTLE)).toBe(true);
    // "for free" — a cost-6 Turtle, and not a single resource moved for it.
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBeforeFreePlay);
  });

  it("only offers Creatures within the +3 ceiling", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, SPEEDER)            // cost 1 — NOT a Creature
      .WithGroundUnitForPlayer(1, MARINE)             // cost 2 — NOT a Creature
      .WithCardInHandForPlayer(1, BIGGER_FISH)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    // No friendly Creature at all, so there is nothing to defeat and the event does nothing.
    expect(needs(g)).toBeUndefined();
  });

  it("a Creature over the ceiling is not offered", async () => {
    const g = new GameTestAdapter();
    // Defeat a cost-1 Creature? There is none; use the Wampa (4) with only a cost-12 in hand.
    g.loadNewState(base()
      .WithGroundUnitForPlayer(1, WAMPA)
      .WithCardInHandForPlayer(1, BIGGER_FISH)
      .WithCardInHandForPlayer(1, Cards.units.ash.summaVerminoth) // cost 12 > 4 + 3
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [find(g, 1, WAMPA).playId] });

    // The Wampa still died — "if you do" is satisfied — but nothing in hand qualifies, so no
    // play prompt opens at all. Asserting only "it isn't in play" would pass against a prompt
    // that was offered and simply never answered.
    expect(g.state.player1.groundArena.some(x => x.cardId === WAMPA)).toBe(false);
    expect(needs(g)).toBeUndefined();
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.ash.summaVerminoth)).toBe(true);
  });
});

describe("HMW_110 Emperor Palpatine — Consolidating Power", () => {
  it("takes control of a cheap enemy unit and gives it 2 Weakness tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, MARINE) // cost 2
      .WithCardInHandForPlayer(1, PALPATINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    const stolen = g.state.player1.groundArena.find(x => x.cardId === MARINE);
    expect(stolen).toBeDefined();
    expect(stolen!.upgrades.filter(u => u.cardId === WEAKNESS)).toHaveLength(2);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, MARINE)
      .WithCardInHandForPlayer(1, PALPATINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("does not offer a unit costing 4 or more", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, WAMPA)   // cost 4 — over the limit
      .WithGroundUnitForPlayer(2, MARINE)  // cost 2 — legal
      .WithCardInHandForPlayer(1, PALPATINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(offered(g)).toEqual([find(g, 2, MARINE).playId]);
  });

  it("is not offered at all with no legal target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithGroundUnitForPlayer(2, WAMPA)
      .WithCardInHandForPlayer(1, PALPATINE)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(needs(g)).toBeUndefined();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});

describe("HMW_134 Zam Wesell", () => {
  it("has Hidden", () => {
    expect(HasHidden(ZAM)).toBe(true);
  });

  it("gains the friendly leader's traits, but never Force", () => {
    const g = new GameTestAdapter();
    // Darth Vader's leader card is Force, Imperial, Sith.
    g.loadNewState(base().WithGroundUnitForPlayer(1, ZAM).Build());
    const zam = find(g, 1, ZAM);

    expect(TraitContains(ZAM, "Imperial", 1, zam.playId)).toBe(true);
    expect(TraitContains(ZAM, "Sith", 1, zam.playId)).toBe(true);
    expect(TraitContains(ZAM, "Force", 1, zam.playId)).toBe(false); // explicitly excluded
    expect(TraitContains(ZAM, "Underworld", 1, zam.playId)).toBe(true); // keeps her own
  });

  it("gains them even while she is NOT in play", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, ZAM).Build());

    // Asked with only the owner — she is in hand, so there is no playId to pass.
    expect(TraitContains(ZAM, "Imperial", 1)).toBe(true);
    expect(TraitContains(ZAM, "Force", 1)).toBe(false);
  });

  it("does not gain the ENEMY leader's traits", () => {
    const g = new GameTestAdapter();
    // Sabine Wren (P2's leader) is Rebel, Spectre.
    g.loadNewState(base().WithGroundUnitForPlayer(1, ZAM).Build());
    const zam = find(g, 1, ZAM);

    expect(TraitContains(ZAM, "Rebel", 1, zam.playId)).toBe(false);
  });
});
