import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { TraitContains } from "@/server/engine/core-functions";

// HMW_108 The First Legion — Vader's Fist (Unit, cost 4, 5/5 Ground, Command/Villainy,
//   Imperial/Trooper, unique)
//   "On Attack: Name a trait. Enemy cards, including those not in play, lose that trait for
//    this phase."
//
// Three things the text only implies, and all three are tested below:
//   • the effect is phase-scoped, NOT tied to this unit — it outlives the Legion being defeated;
//   • it follows CONTROL in play and ownership out of play, so your own cards keep the trait;
//   • "including those not in play" means hand, deck and discard too, which is why the read is
//     asked of whoever holds the card rather than of a unit in an arena.
const LEGION = Cards.units.hmw.theFirstLegion;
const SPEEDER = Cards.units.sec.skyhopperCanyonRunner; // 1/4 Ground — Fringe, Vehicle, Speeder
const MARINE = Cards.units.sor.battlefieldMarine;      // Rebel, Trooper
const TURRET = Cards.upgrades.jtl.dorsalTurret;        // "Attach to a Vehicle unit."

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP) // Command
    .MyLeader(Cards.leaders.sor.darthVader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20)
    .WithGroundUnitForPlayer(1, LEGION);
}

const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const choices = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? r.fromChoices : undefined;
};

/** The Legion attacks the enemy base and names `trait`. */
async function nameTrait(g: GameTestAdapter, trait: string) {
  const legion = g.state.player1.groundArena.find(u => u.cardId === LEGION)!;
  await g.dispatchAsync(1, "initiate-attack", { playId: legion.playId });
  await g.chooseBaseAsync(1, 2);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [trait] });
}

describe("HMW_108 The First Legion — naming", () => {
  it("offers the whole printed trait universe", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    const legion = g.state.player1.groundArena.find(u => u.cardId === LEGION)!;
    await g.dispatchAsync(1, "initiate-attack", { playId: legion.playId });
    await g.chooseBaseAsync(1, 2);

    const pool = choices(g);
    expect(pool).toBeDefined();
    // Not narrowed to traits the opponent happens to hold: narrowing would leak what is in their
    // deck and hand. Naming a trait nobody has is legal and simply does nothing.
    expect(pool!.length).toBeGreaterThan(100);
    expect(pool).toContain("Vehicle");
    expect(pool).toContain("Trooper");
  });

  it("an unrecognised answer arms nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, SPEEDER).Build());

    await nameTrait(g, "NotARealTrait");

    // No suppression is armed at all. Asserting the bogus trait is "absent" would pass either
    // way; what matters is that a hand-rolled client cannot plant a flag of its own choosing.
    expect(g.state.currentEffects.filter(e => e.cardId.startsWith("HMW_108_trait"))).toHaveLength(0);
    const speeder = g.state.player2.groundArena[0];
    expect(TraitContains(SPEEDER, "Vehicle", 2, speeder.playId)).toBe(true);
  });

  it("naming a trait nobody has is legal and does nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());

    await nameTrait(g, "Ewok");

    // A real trait, so it IS armed — it just matches nothing the opponent holds.
    expect(g.state.currentEffects.filter(e => e.cardId === "HMW_108_trait|Ewok")).toHaveLength(1);
    const marine = g.state.player2.groundArena[0];
    expect(TraitContains(MARINE, "Trooper", 2, marine.playId)).toBe(true);
    expect(g.state.player2.base.damage).toBe(5); // the attack still resolved
  });
});

describe("HMW_108 The First Legion — scoping", () => {
  it("enemy units lose the trait and friendly units keep it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, SPEEDER)
      .WithGroundUnitForPlayer(2, SPEEDER)
      .Build());

    await nameTrait(g, "Vehicle");

    const mine = g.state.player1.groundArena.find(u => u.cardId === SPEEDER)!;
    const theirs = g.state.player2.groundArena.find(u => u.cardId === SPEEDER)!;
    expect(TraitContains(SPEEDER, "Vehicle", 2, theirs.playId)).toBe(false);
    expect(TraitContains(SPEEDER, "Vehicle", 1, mine.playId)).toBe(true);
  });

  it("takes exactly the named trait, not the card's others", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, SPEEDER).Build());

    await nameTrait(g, "Vehicle");

    const theirs = g.state.player2.groundArena[0];
    expect(TraitContains(SPEEDER, "Vehicle", 2, theirs.playId)).toBe(false);
    expect(TraitContains(SPEEDER, "Fringe", 2, theirs.playId)).toBe(true);
    expect(TraitContains(SPEEDER, "Speeder", 2, theirs.playId)).toBe(true);
  });

  it("reaches a deployed enemy leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
      .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
      .Build());

    await nameTrait(g, "Rebel");

    const sabine = g.state.player2.groundArena[0];
    expect(TraitContains(Cards.leaders.sor.sabineWren, "Rebel", 2, sabine.playId)).toBe(false);
  });

  it("a base trait can be named, and only the enemy base loses it", async () => {
    const g = new GameTestAdapter();
    // Both players on a Death Star base, so the scoping is the only thing that can differ.
    g.loadNewState(setup()
      .MyBase(Cards.bases.common.green30HP)
      .TheirBase(Cards.bases.common.green30HP)
      .Build());

    await nameTrait(g, "Death Star");

    expect(TraitContains(Cards.bases.common.green30HP, "Death Star", 2)).toBe(false);
    expect(TraitContains(Cards.bases.common.green30HP, "Death Star", 1)).toBe(true);
  });
});

describe("HMW_108 The First Legion — cards not in play", () => {
  it("reaches a card in the enemy's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInHandForPlayer(2, SPEEDER).Build());

    await nameTrait(g, "Vehicle");

    // Asked of the holder, since a card in hand has no arena to carry an effect.
    expect(TraitContains(SPEEDER, "Vehicle", 2)).toBe(false);
    expect(TraitContains(SPEEDER, "Vehicle", 1)).toBe(true);
  });

  it("reaches a card in the enemy's deck and discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithCardInDeckForPlayer(2, SPEEDER)
      .WithCardInDiscardForPlayer(2, SPEEDER)
      .Build());

    await nameTrait(g, "Vehicle");

    expect(TraitContains(SPEEDER, "Vehicle", 2)).toBe(false);
  });
});

describe("HMW_108 The First Legion — duration", () => {
  it("outlives the Legion being defeated by its own attack", async () => {
    const g = new GameTestAdapter();
    // The Legion attacks into a unit big enough to kill it, so it names and then dies.
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, Cards.units.ash.dinosaurTurtle) // 7/7 kills a 5/5
      .WithGroundUnitForPlayer(2, SPEEDER)
      .Build());

    const legion = g.state.player1.groundArena.find(u => u.cardId === LEGION)!;
    await g.dispatchAsync(1, "initiate-attack", { playId: legion.playId });
    const turtle = g.state.player2.groundArena.find(u => u.cardId === Cards.units.ash.dinosaurTurtle)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [turtle.playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["Vehicle"] });

    expect(g.state.player1.groundArena.some(u => u.cardId === LEGION)).toBe(false); // it died
    const speeder = g.state.player2.groundArena.find(u => u.cardId === SPEEDER)!;
    // "for this phase", not "while this unit is in play".
    expect(TraitContains(SPEEDER, "Vehicle", 2, speeder.playId)).toBe(false);
  });

  it("expires at the end of the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, SPEEDER).Build());

    await nameTrait(g, "Vehicle");
    const speeder = g.state.player2.groundArena[0];
    expect(TraitContains(SPEEDER, "Vehicle", 2, speeder.playId)).toBe(false);

    // Phase-duration effects are cleared when the phase ends.
    g.state.currentEffects = g.state.currentEffects.filter(e => e.duration !== "Phase");
    expect(TraitContains(SPEEDER, "Vehicle", 2, speeder.playId)).toBe(true);
  });
});

describe("HMW_108 The First Legion — restrictions that read the trait", () => {
  it("an enemy Vehicle-only upgrade loses its host", async () => {
    // "Attach to a Vehicle unit." Strip the trait and the opponent's turret has nowhere to go.
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, SPEEDER)
      .WithCardInHandForPlayer(2, TURRET)
      .Build());

    await nameTrait(g, "Vehicle");
    await g.dispatchAsync(2, "play-card", { cardId: TURRET, fromZone: "Hand" });

    // No legal host, so it never attaches.
    const speeder = g.state.player2.groundArena[0];
    expect(speeder.upgrades.some(u => u.cardId === TURRET)).toBe(false);
  });

  it("control: with a different trait named, that upgrade still attaches", async () => {
    // Without this the case above would pass against an upgrade that could never attach at all.
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, SPEEDER)
      .WithCardInHandForPlayer(2, TURRET)
      .Build());

    await nameTrait(g, "Ewok"); // irrelevant trait
    await g.dispatchAsync(2, "play-card", { cardId: TURRET, fromZone: "Hand" });
    const speeder = g.state.player2.groundArena[0];
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [speeder.playId] });

    expect(g.state.player2.groundArena[0].upgrades.some(u => u.cardId === TURRET)).toBe(true);
  });
});
