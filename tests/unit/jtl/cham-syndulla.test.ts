import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_164 Cham Syndulla — Rallying Ryloth (5/4 Ground, cost 4, unique, Aggression)
//   "When Played: If an opponent controls more resources than you, you may put the top card of your
//    deck into play as a resource."

const CHAM = Cards.units.jtl.chamSyndulla;
const MARINE = Cards.units.sor.battlefieldMarine;
const DECK_TOP = Cards.units.sor.consularSecurityForce;

function setup(mine: number, theirs: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, mine)
    .FillResourcesForPlayer(2, MARINE, theirs)
    .WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(1, DECK_TOP)
    .WithCardInHandForPlayer(1, CHAM);
}

describe("JTL_164 Cham Syndulla", () => {
  it("opponent has more resources: may put the top card of the deck into play as a resource", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, 5).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);

    const res = g.state.player1.resources;
    expect(res).toHaveLength(5);
    expect(res[res.length - 1].cardId).toBe(DECK_TOP);
    expect(res[res.length - 1].ready).toBe(false);
    expect(g.state.player1.deck.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("declining leaves the deck and resources alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(4, 5).Build());

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.resources).toHaveLength(4);
    expect(g.state.player1.deck).toHaveLength(2);
  });

  it("equal resources: no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5, 5).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.resources).toHaveLength(5);
    expect(g.state.player1.deck).toHaveLength(2);
  });

  it("control: fewer opponent resources → no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(6, 5).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.resources).toHaveLength(6);
  });

  it("an empty deck: no offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, MARINE, 4)
      .FillResourcesForPlayer(2, MARINE, 5)
      .WithCardInHandForPlayer(1, CHAM)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.resources).toHaveLength(4);
  });
});
