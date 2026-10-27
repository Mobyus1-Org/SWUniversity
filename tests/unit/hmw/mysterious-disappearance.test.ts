import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// HMW_058 Mysterious Disappearance (Event, cost 2, Cunning/Vigilance, Trick) —
//   "A player chooses a non-leader unit they control. You may defeat that unit. If you do, that
//    player creates a Beast token."
//
// Three decisions, by two different players: the caster picks a player; THAT player picks one of
// their own non-leader units; the caster then decides whether to defeat it. The Beast goes to the
// chosen player, and only if the unit really was defeated — a unit immune to enemy defeat survives
// and nobody gets a Beast. A player with no non-leader unit can't be chosen; when only one player
// qualifies they are picked automatically, and when neither does the event does nothing.

const MYSTERIOUS = Cards.events.hmw.mysteriousDisappearance;
const BEAST = Cards.units.token.beast;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 Ground, no abilities
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3 Ground, no abilities
const PHANTOM = Cards.units.shd.lurkingTiePhantom; // can't be defeated by enemy card abilities
const SABINE = Cards.leaders.sor.sabineWren;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, MYSTERIOUS)
    .WithActivePlayer(1);
}

const prompt = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded as
  { type?: string; options?: string[]; fromPlayIds?: string[]; helperText?: string } | undefined;
const unitsOf = (g: GameTestAdapter, player: 1 | 2) => {
  const p = player === 1 ? g.state.player1 : g.state.player2;
  return [...p.groundArena, ...p.spaceArena];
};
const beasts = (g: GameTestAdapter, player: 1 | 2) => unitsOf(g, player).filter(u => u.cardId === BEAST);

describe("HMW_058 Mysterious Disappearance", () => {
  it("choose the opponent: they pick their unit, the caster defeats it, they get a Beast", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(prompt(g)?.type).toBe("Option");
    expect(prompt(g)?.options).toEqual(["you", "opponent"]);
    await g.chooseOptionAsync(1, "opponent");

    // The OPPONENT picks, among their own units only.
    const [theirCsf, theirMarine] = g.state.player2.groundArena;
    expect(prompt(g)?.type).toBe("Target");
    expect(prompt(g)?.fromPlayIds?.sort()).toEqual([theirCsf.playId, theirMarine.playId].sort());
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [theirCsf.playId] });

    expect(prompt(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(g.state.player2.groundArena.some(u => u.playId === theirCsf.playId)).toBe(false);
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(CSF);
    expect(beasts(g, 2)).toHaveLength(1);
    expect(beasts(g, 1)).toHaveLength(0);
    expect(g.state.player2.groundArena.some(u => u.cardId === MARINE)).toBe(true); // the other unit stays
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("choose yourself: you pick your unit, defeat it, and get the Beast", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "you");
    const mine = g.state.player1.groundArena[0];
    expect(prompt(g)?.fromPlayIds).toEqual([mine.playId]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [mine.playId] });
    await g.chooseYesAsync(1);

    expect(g.state.player1.discard.map(c => c.cardId)).toContain(MARINE);
    expect(beasts(g, 1)).toHaveLength(1);
    expect(beasts(g, 2)).toHaveLength(0);
    expect(g.state.player2.groundArena[0].cardId).toBe(CSF);
  });

  it("declining the defeat leaves the unit and creates no Beast", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "opponent");
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(prompt(g)?.type).toBe("Option"); // the "may" was really offered
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([CSF]);
    expect(beasts(g, 2)).toHaveLength(0);
    expect(beasts(g, 1)).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("leader units are not offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE, true, true)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SABINE) // deployed leader unit
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "opponent");

    const csf = g.state.player2.groundArena.find(u => u.cardId === CSF)!;
    expect(prompt(g)?.fromPlayIds).toEqual([csf.playId]);
  });

  it("a player whose only unit is a leader can't be chosen — the other player is picked automatically", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE, true, true)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SABINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // Straight to the caster's own pick: no player choice is asked.
    expect(prompt(g)?.type).toBe("Target");
    expect(prompt(g)?.fromPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
  });

  it("does nothing when neither player controls a non-leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE, true, true)
        .WithGroundUnitForPlayer(2, SABINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MYSTERIOUS]);
    expect(beasts(g, 1)).toHaveLength(0);
    expect(beasts(g, 2)).toHaveLength(0);
  });

  it("an enemy unit immune to enemy defeat survives and no Beast is created", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithSpaceUnitForPlayer(2, PHANTOM)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "opponent");
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });
    // The defeat can't happen, so it isn't offered.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();

    expect(g.state.player2.spaceArena.map(u => u.cardId)).toEqual([PHANTOM]);
    expect(beasts(g, 2)).toHaveLength(0);
  });

  it("control: the caster may defeat their OWN immune unit — the immunity is to enemy abilities", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .TheirLeader(SABINE)
        .WithSpaceUnitForPlayer(1, PHANTOM)
        .WithGroundUnitForPlayer(2, CSF)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "you");
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.spaceArena[0].playId] });
    expect(prompt(g)?.type).toBe("Option");
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(beasts(g, 1)).toHaveLength(1);
  });
});
