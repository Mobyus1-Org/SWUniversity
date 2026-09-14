import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_155 They Hate That Ship (Event, cost 1, Aggression/Heroism)
//   "An opponent creates 2 TIE Fighter tokens and readies them. Then, play a Vehicle unit from your
//    hand. It costs 3 resources less."
//
// The discount comes off the full cost, aspect penalty included.

const EVENT = Cards.events.jtl.theyHateThatShip;
const STARVIPER = Cards.units.jtl.cloakedStarViper;       // cost 4 Vigilance Vehicle, When Played: 2 Shields
const FIRESPRAY = Cards.units.jtl.relentlessFirespray;    // cost 6 Aggression Vehicle
const MARINE = Cards.units.sor.battlefieldMarine;         // not a Vehicle
const TIE = Cards.units.token.tieFighter;

function setup(resources: number, base = Cards.bases.common.blue30HP) {
  // Sabine (Aggression/Heroism) covers the event; the Vigilance base covers the StarViper.
  return new GameStateBuilder()
    .MyBase(base)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithCurrentRoundBeing(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .WithCardInHandForPlayer(1, EVENT);
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("JTL_155 They Hate That Ship", () => {
  it("turn 1 with 2 resources: the event, then a Cloaked StarViper for the 1 resource left", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(2).WithCardInHandForPlayer(1, STARVIPER).Build());

    await g.playCardFromHandAsync(1, 0);
    // The opponent's two TIE Fighters arrive ready.
    const ties = g.state.player2.spaceArena.filter(u => u.cardId === TIE);
    expect(ties).toHaveLength(2);
    expect(ties.every(t => t.ready)).toBe(true);
    expect(g.state.player1.spaceArena).toHaveLength(0);

    // Then play a Vehicle from hand: the StarViper is now the only hand card.
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    await g.chooseCardFromHandAsync(1, 0);

    const viper = g.state.player1.spaceArena.find(u => u.cardId === STARVIPER)!;
    expect(viper).toBeDefined();
    expect(viper.upgrades.map(u => u.cardId)).toEqual([Cards.upgrades.token.shield, Cards.upgrades.token.shield]);
    expect(readyResources(g)).toBe(0);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("the discount comes off the aspect penalty too (StarViper off-aspect: 4 + 2 − 3 = 3)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5, Cards.bases.common.red30HP).WithCardInHandForPlayer(1, STARVIPER).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === STARVIPER)).toBe(true);
    expect(readyResources(g)).toBe(1); // 5 − 1 − 3
  });

  it("only Vehicle units are offered, and a non-Vehicle pick is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(6).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, STARVIPER).Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromIndices?: number[] };
    expect(res.fromIndices).toEqual([1]); // hand is now [Marine, StarViper]

    await g.chooseCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.invalidAction).toBeTruthy();
    expect(g.state.player1.groundArena).toHaveLength(0);

    await g.chooseCardFromHandAsync(1, 1);
    expect(g.state.player1.spaceArena.some(u => u.cardId === STARVIPER)).toBe(true);
  });

  it("no Vehicle in hand: the TIEs are still created and nothing is played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(6).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.spaceArena.filter(u => u.cardId === TIE)).toHaveLength(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("a Vehicle still unaffordable after the discount isn't offered", async () => {
    const g = new GameTestAdapter();
    // 2 resources: 1 left after the event, the Firespray still costs 6 − 3 = 3.
    g.loadNewState(setup(2, Cards.bases.common.red30HP).WithCardInHandForPlayer(1, FIRESPRAY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.spaceArena.filter(u => u.cardId === TIE)).toHaveLength(2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([FIRESPRAY]);
  });

  it("control: without the event the StarViper costs its full 4", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, MARINE, 2)
      .WithCardInHandForPlayer(1, STARVIPER)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([STARVIPER]);
  });
});
