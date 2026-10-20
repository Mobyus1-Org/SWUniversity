import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_065 Clone of the Zillo Beast — Emperor's Experiment
//   (Unit, cost 4, 6/6 Ground, Vigilance/Villainy, Clone/Creature)
//   "Other friendly units get –2/–2."
//   "On Attack: You may give a Weakness token to a unit."
//
// The aura says OTHER FRIENDLY units, with no "non-leader" clause — so it spares itself, spares
// the enemy, and does hit your own leader unit. It is also a liability: the moment it lands, your
// small units can die to it.
const ZILLO = Cards.units.hmw.zilloClone;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const DROID = Cards.units.token.battleDroid;      // 1/1 token
const WEAKNESS = Cards.units.token.weakness;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)   // Vigilance
    .MyLeader(Cards.leaders.sor.darthVader) // Aggression/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const stats = (u: { cardId: string }) => {
  const unit = Unit.FromInterface(u as never);
  return { power: unit.CurrentPower(), hp: unit.TotalHP() };
};
const find = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.find(u => u.cardId === cardId)!;
const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;

describe("HMW_065 Clone of the Zillo Beast — the aura", () => {
  it("shrinks other friendly units by 2/2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, ZILLO)
      .WithGroundUnitForPlayer(1, MARINE)
      .Build());

    expect(stats(find(g, 1, MARINE))).toEqual({ power: 1, hp: 1 }); // 3/3 - 2/2
  });

  it("does not shrink itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, ZILLO).Build());

    expect(stats(find(g, 1, ZILLO))).toEqual({ power: 6, hp: 6 });
  });

  it("does not shrink enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, ZILLO)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build());

    expect(stats(find(g, 2, MARINE))).toEqual({ power: 3, hp: 3 });
  });

  it("DOES shrink your own leader unit — there is no non-leader clause", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .MyLeader(Cards.leaders.sor.darthVader, true, true)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, ZILLO)
      .Build());

    // Darth Vader's unit side is 5/8, so the aura brings him to 3/6.
    expect(stats(find(g, 1, Cards.leaders.sor.darthVader))).toEqual({ power: 3, hp: 6 });
  });

  it("the aura lifts when the Zillo leaves play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, ZILLO)
      .WithGroundUnitForPlayer(1, MARINE)
      .Build());

    expect(stats(find(g, 1, MARINE))).toEqual({ power: 1, hp: 1 });

    g.state.player1.groundArena = g.state.player1.groundArena.filter(u => u.cardId !== ZILLO);
    expect(stats(find(g, 1, MARINE))).toEqual({ power: 3, hp: 3 });
  });

  it("playing it kills your own 1/1 token on the way in", async () => {
    // The dangerous half of the card: the aura applies the moment it enters, and nothing else on
    // the entry path re-checks HP, so the sweep has to run for it.
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, DROID)
      .WithCardInHandForPlayer(1, ZILLO)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.some(u => u.cardId === DROID)).toBe(false);
    expect(g.state.player1.groundArena.some(u => u.cardId === ZILLO)).toBe(true);
  });
});

describe("HMW_065 Clone of the Zillo Beast — On Attack", () => {
  function attackSetup() {
    return setup()
      .WithGroundUnitForPlayer(1, ZILLO)
      .WithGroundUnitForPlayer(2, MARINE);
  }

  it("may give a Weakness token to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the Marine
    expect(needs(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // token onto the Marine, before combat damage

    const marine = g.state.player2.groundArena.find(u => u.cardId === MARINE);
    // 3/3 under a Weakness token is 2/2, and the Zillo's 6 power then finishes it.
    expect(marine).toBeUndefined();
  });

  it("the On Attack may be declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(needs(g)?.type).toBe("Option");
    await g.chooseNoAsync(1);

    // The attack still happens; the Marine just dies without a token on it first.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === WEAKNESS)).toBe(false);
  });

  it("the token may go on any unit, the Zillo included", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(attackSetup().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // onto itself

    const zillo = g.state.player1.groundArena.find(u => u.cardId === ZILLO)!;
    expect(zillo.upgrades.some(u => u.cardId === WEAKNESS)).toBe(true);
  });
});
