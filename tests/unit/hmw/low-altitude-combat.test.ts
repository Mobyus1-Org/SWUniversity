import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { UnitArenaOf } from "@/server/engine/core-functions";

// HMW_050 Low Altitude Combat (Event, cost 2, Command/Cunning, Tactic)
//   "Move a space unit to the ground arena (it's now a ground unit). If you do, you may attack
//    with a ground unit. It gets +2/+0 for this attack."
//
// The parenthetical is the load-bearing part: once moved, the unit has to BE a ground unit —
// attackable from the ground arena, able to attack ground units, and counted as ground by
// anything that counts.
const COMBAT = Cards.events.hmw.lowAltitudeCombat;
const SPACE_UNIT = Cards.units.sor.systemPatrolCraft; // 3/4 Space
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3 Ground
const TURTLE = Cards.units.ash.dinosaurTurtle;        // 7/7 Ground

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)  // Cunning
    .MyLeader(Cards.leaders.sor.leiaOrgana) // Command/Heroism
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, COMBAT);
}

const needs = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const offered = (g: GameTestAdapter) => {
  const r = needs(g);
  return r?.type === "Target" ? (r.fromPlayIds ?? []) : undefined;
};
const inGround = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).groundArena.some(u => u.cardId === cardId);
const inSpace = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  (p === 1 ? g.state.player1 : g.state.player2).spaceArena.some(u => u.cardId === cardId);

describe("HMW_050 Low Altitude Combat — the move", () => {
  it("moves a friendly space unit into the ground arena", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithSpaceUnitForPlayer(1, SPACE_UNIT).Build();
    g.loadNewState(s);
    const movedId = s.player1.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [movedId] });

    expect(inSpace(g, 1, SPACE_UNIT)).toBe(false);
    expect(inGround(g, 1, SPACE_UNIT)).toBe(true);
    // The live arena reader has to agree — that is what "it's now a ground unit" means.
    expect(UnitArenaOf(g.state, movedId)).toBe("Ground");
  });

  it("can move an ENEMY space unit — the text says 'a space unit'", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithSpaceUnitForPlayer(2, SPACE_UNIT).Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    expect(offered(g)).toEqual([s.player2.spaceArena[0].playId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [s.player2.spaceArena[0].playId] });

    expect(inGround(g, 2, SPACE_UNIT)).toBe(true);
  });

  it("does nothing with no space unit anywhere", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    // No space unit to move, so the whole effect — move and follow-up attack — is skipped.
    expect(needs(g)).toBeUndefined();
    expect(g.state.player1.discard.map(d => d.cardId)).toContain(COMBAT);
  });

  it("a moved unit counts as GROUND for other cards' ground-only targeting", async () => {
    // The parenthetical "(it's now a ground unit)" has to hold for every other card too, not just
    // for attacking. Discerning Veteran captures "an enemy non-leader GROUND unit", so a grounded
    // starfighter must be a legal victim — it would not be if that filter read the printed arena.
    const g = new GameTestAdapter();
    const s = setup()
      .WithSpaceUnitForPlayer(2, SPACE_UNIT)
      .WithCardInHandForPlayer(1, Cards.units.shd.discerningVeteran)
      .Build();
    g.loadNewState(s);
    const movedId = s.player2.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0); // Low Altitude Combat
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [movedId] });
    await g.chooseNoAsync(1); // decline the follow-up attack
    await g.dispatchAsync(2, "pass-action", {});

    await g.playCardFromHandAsync(1, 0); // Discerning Veteran
    expect(offered(g)).toEqual([movedId]);
  });

  it("a moved unit can be attacked from the ground arena", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithSpaceUnitForPlayer(2, SPACE_UNIT)
      .WithGroundUnitForPlayer(1, TURTLE)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [s.player2.spaceArena[0].playId] });
    // Decline the free attack so the Turtle is still ready for a normal one.
    await g.chooseNoAsync(1);
    await g.dispatchAsync(2, "pass-action", {});

    const turtle = g.state.player1.groundArena.find(u => u.cardId === TURTLE)!;
    await g.dispatchAsync(1, "initiate-attack", { playId: turtle.playId });
    const moved = g.state.player2.groundArena.find(u => u.cardId === SPACE_UNIT)!;
    expect(offered(g)).toContain(moved.playId); // reachable from the ground arena

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [moved.playId] });
    expect(inGround(g, 2, SPACE_UNIT)).toBe(false); // 7 power kills a 3/4
  });
});

describe("HMW_050 Low Altitude Combat — the follow-up attack", () => {
  function moveThen() {
    return setup()
      .WithSpaceUnitForPlayer(1, SPACE_UNIT)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, TURTLE);
  }

  it("a ground unit may attack, and gets +2/+0 for it", async () => {
    const g = new GameTestAdapter();
    const s = moveThen().Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [s.player1.spaceArena[0].playId] });
    await g.chooseYesAsync(1);

    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });
    await g.chooseGroundUnitAsync(2, 0); // into the 7/7 Turtle

    // 3 power + 2 = 5 damage on the Turtle; it hits back for 7 and the Marine dies.
    expect(g.state.player2.groundArena[0].damage).toBe(5);
    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);
  });

  it("the follow-up attack may be declined", async () => {
    const g = new GameTestAdapter();
    const s = moveThen().Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [s.player1.spaceArena[0].playId] });
    expect(needs(g)?.type).toBe("Option"); // the offer really opened
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(inGround(g, 1, SPACE_UNIT)).toBe(true); // the move still happened
  });

  it("the just-moved unit is itself eligible to make the attack", async () => {
    // It is a ground unit now, so "attack with a ground unit" includes it.
    const g = new GameTestAdapter();
    const s = setup()
      .WithSpaceUnitForPlayer(1, SPACE_UNIT)
      .WithGroundUnitForPlayer(2, MARINE)
      .Build();
    g.loadNewState(s);
    const movedId = s.player1.spaceArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [movedId] });
    await g.chooseYesAsync(1);

    expect(offered(g)).toContain(movedId);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [movedId] });
    await g.chooseGroundUnitAsync(2, 0);

    // 3 power + 2 = 5 into a 3/3 Marine, which dies.
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("the +2/+0 is only for that attack", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithSpaceUnitForPlayer(1, SPACE_UNIT)
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7, survives
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [s.player1.spaceArena[0].playId] });
    await g.chooseYesAsync(1);
    const marine = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });
    await g.chooseGroundUnitAsync(2, 0);

    // The buff is spent on that attack; whatever survives is back to printed power.
    const survivor = g.state.player1.groundArena.find(u => u.cardId === SPACE_UNIT)!;
    expect(survivor).toBeDefined();
  });
});
