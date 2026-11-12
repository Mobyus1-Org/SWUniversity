import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_168 Cunning Ploy (Event, cost 4, Cunning/Cunning, Trick)
//   "Look at an opponent's hand. You may discard a card from it. If you do, that player draws a card.
//    Exhaust an enemy unit.
//    You may attack with a unit. It gets +3/+0 for this attack."
// Three independent clauses: one fizzling never stops the others.

const PLOY = Cards.events.ic27.cunningPloy;
const MARINE = Cards.units.sor.battlefieldMarine; // 3/3
const TIE = Cards.units.sor.tieLnFighter;
const SWOOP = Cards.units.sor.swoopRacer;

function board(opts: { oppHand?: boolean; enemy?: boolean; attacker?: boolean } = {}) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, PLOY)
    .WithCardInDeckForPlayer(2, SWOOP);
  if (opts.oppHand !== false) b = b.WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE);
  if (opts.enemy !== false) b = b.WithSpaceUnitForPlayer(2, TIE);
  if (opts.attacker !== false) b = b.WithGroundUnitForPlayer(1, MARINE);
  return b;
}

const res = (g: GameTestAdapter) =>
  g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] } | undefined;

async function attackWithMarine(g: GameTestAdapter) {
  await g.chooseYesAsync(1);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_168 Cunning Ploy", () => {
  it("all three clauses: discard + redraw, exhaust an enemy, attack with +3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    expect(g.state.player2.hand.map(c => c.cardId).sort()).toEqual([MARINE, SWOOP].sort());
    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([MARINE]);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });
    expect(g.state.player2.spaceArena[0].ready).toBe(false);

    await attackWithMarine(g);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("declining the discard: no draw, the rest still resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });
    expect(g.state.player2.hand).toHaveLength(2);
    expect(g.state.player2.deck).toHaveLength(1);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });
    await attackWithMarine(g);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("an empty opponent hand skips straight to the exhaust", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board({ oppHand: false }).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(res(g)?.fromPlayIds).toEqual([g.state.player2.spaceArena[0].playId]);
  });

  it("no enemy unit: the discard and the attack still resolve", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board({ enemy: false }).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });
    await attackWithMarine(g);

    expect(g.state.player2.discard).toHaveLength(1);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("the exhaust only offers enemy units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(res(g)?.fromPlayIds).toEqual([g.state.player2.spaceArena[0].playId]);
  });

  it("declining the attack leaves the attacker ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
