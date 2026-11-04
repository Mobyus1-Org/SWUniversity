import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";

// IC27_149 The Invisible Hand — Confederate Might (9/9 Space, cost 10, Cunning/Villainy)
//   "When Played/When Defeated: The next card you play this phase costs 9 resources less."
// Any card type. One-shot: the next card played uses it up, and a cost can't go below 0.

const HAND = Cards.units.ic27.theInvisibleHand;
const MARINE = Cards.units.sor.battlefieldMarine;   // cost 2
const THRAWN = Cards.units.ic27.grandAdmiralThrawn; // cost 6
const CRACKDOWN = Cards.events.twi.lethalCrackdown; // event
const TRAINING = Cards.upgrades.sor.academyTraining; // upgrade

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

describe("IC27_149 The Invisible Hand — When Played", () => {
  it("the next card of any type costs 9 less, never below 0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, HAND).Build());
    const thrawn = playCost(g.state, 1, THRAWN);
    const crackdown = playCost(g.state, 1, CRACKDOWN);
    const training = playCost(g.state, 1, TRAINING);

    await g.playCardFromHandAsync(1, 0);

    expect(playCost(g.state, 1, THRAWN)).toBe(Math.max(0, thrawn - 9));
    expect(playCost(g.state, 1, CRACKDOWN)).toBe(Math.max(0, crackdown - 9));
    expect(playCost(g.state, 1, TRAINING)).toBe(Math.max(0, training - 9));
    expect(playCost(g.state, 1, MARINE)).toBe(0);
  });

  it("control: it does not discount itself", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, HAND).Build());

    expect(playCost(g.state, 1, HAND)).toBeGreaterThanOrEqual(10);
  });

  it("the next card is charged the discounted cost, and the discount is then gone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, HAND).WithCardInHandForPlayer(1, THRAWN).Build());
    const fullThrawn = playCost(g.state, 1, THRAWN);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    const before = readyResources(g);
    await g.playCardFromHandAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option") await g.chooseNoAsync(1); // Thrawn's "may"

    expect(before - readyResources(g)).toBe(Math.max(0, fullThrawn - 9));
    expect(playCost(g.state, 1, THRAWN)).toBe(fullThrawn);
  });

  it("an upgrade can be the next card, and it uses the discount up", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, HAND).WithCardInHandForPlayer(1, TRAINING).Build(),
    );
    const fullThrawn = playCost(g.state, 1, THRAWN);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    const before = readyResources(g);
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].upgrades.map(u => u.cardId)).toContain(TRAINING);
    expect(before - readyResources(g)).toBe(0);
    expect(playCost(g.state, 1, THRAWN)).toBe(fullThrawn);
  });
});

describe("IC27_149 The Invisible Hand — When Defeated", () => {
  it("the next card after it is defeated costs 9 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, HAND).WithCardInHandForPlayer(1, CRACKDOWN).Build());
    const fullThrawn = playCost(g.state, 1, THRAWN);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.spaceArena[0].playId] });

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(playCost(g.state, 1, THRAWN)).toBe(Math.max(0, fullThrawn - 9));
  });

  it("control: the opponent's next card is not discounted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, HAND).WithCardInHandForPlayer(1, CRACKDOWN).Build());
    const theirThrawn = playCost(g.state, 2, THRAWN);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.spaceArena[0].playId] });

    expect(playCost(g.state, 2, THRAWN)).toBe(theirThrawn);
  });
});
