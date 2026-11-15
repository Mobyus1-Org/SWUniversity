import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_184 Fett's Firespray — Pursuing the Bounty (5/6 Space, cost 6, Cunning/Villainy)
//   "When Played: If you control Boba Fett or Jango Fett (as a leader or unit), ready this unit."
//   "Action [2 resources]: Exhaust a non-unique unit."
//
// The Action has no Exhaust in its cost, so the Firespray can use it while exhausted.

const FIRESPRAY = Cards.units.sor.fettsFirespray;
const MARINE = Cards.units.sor.battlefieldMarine;  // non-unique
const KUIIL = Cards.units.shd.kuiil;               // unique

function setup(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithActivePlayer(1);
}

describe("SOR_184 Fett's Firespray — When Played", () => {
  it("enters ready with Boba Fett as your leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.leaders.sor.bobaFett).WithCardInHandForPlayer(1, FIRESPRAY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("enters ready with Jango Fett as a unit you control", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(1, Cards.units.ic27.jangoFett).WithCardInHandForPlayer(1, FIRESPRAY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena[0].ready).toBe(true);
  });

  it("control: without either Fett it enters exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.leaders.sor.sabineWren).WithCardInHandForPlayer(1, FIRESPRAY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });
});

describe("SOR_184 Fett's Firespray — Action [2 resources]", () => {
  function board() {
    return setup(Cards.leaders.sor.sabineWren)
      .WithSpaceUnitForPlayer(1, FIRESPRAY, false) // exhausted — the Action does not need it ready
      .WithGroundUnitForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(2, KUIIL);
  }

  it("exhausts a non-unique unit for 2 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.dispatchAsync(1, "use-ability", { cardId: FIRESPRAY, playId: g.state.player1.spaceArena[0].playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena[0].ready).toBe(false);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(2);
  });

  it("a unique unit can't be chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.dispatchAsync(1, "use-ability", { cardId: FIRESPRAY, playId: g.state.player1.spaceArena[0].playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[1].playId] });

    expect(g.state.player2.groundArena[1].ready).toBe(true);
  });
});
