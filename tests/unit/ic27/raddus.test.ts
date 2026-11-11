import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost, pilotPlayCost } from "@/server/engine/card-playability";

// IC27_043 Raddus — Hope of the Resistance (8/9 Space, cost 9, Vigilance/Heroism)
//   "Restore 3. While this unit is exhausted, cards your opponents play cost 3 resources more."

const RADDUS = Cards.units.ic27.raddus;
const MARINE = Cards.units.sor.battlefieldMarine;   // cost 2 Command/Heroism
const TIE = Cards.units.sor.tieLnFighter;           // cost 1 Villainy
const VANQUISH = Cards.events.sor.vanquish;

function board(raddusReady: boolean) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 10)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.directorKrennic)
    .WithActivePlayer(1)
    .WithSpaceUnitForPlayer(1, RADDUS, raddusReady);
}

describe("IC27_043 Raddus — Restore 3", () => {
  it("heals 3 from your base when he attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(7);
    expect(g.state.player2.base.damage).toBe(8);
  });
});

describe("IC27_043 Raddus — opponent cost tax", () => {
  it("while he is exhausted, an opponent's unit and event cost 3 more", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false).Build());
    const untaxed = new GameTestAdapter();
    untaxed.loadNewState(board(true).Build());

    expect(playCost(g.state, 2, TIE)).toBe(playCost(untaxed.state, 2, TIE) + 3);
    expect(playCost(g.state, 2, VANQUISH)).toBe(playCost(untaxed.state, 2, VANQUISH) + 3);
  });

  it("does not tax his own controller", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false).Build());
    const untaxed = new GameTestAdapter();
    untaxed.loadNewState(board(true).Build());

    expect(playCost(g.state, 1, MARINE)).toBe(playCost(untaxed.state, 1, MARINE));
  });

  it("taxes a Piloting play too", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false).Build());
    const untaxed = new GameTestAdapter();
    untaxed.loadNewState(board(true).Build());
    const pilot = Cards.units.jtl.frisk; // Piloting 2

    expect(pilotPlayCost(g.state, 2, pilot)).toBe(pilotPlayCost(untaxed.state, 2, pilot) + 3);
  });

  it("is enforced on a real play: the opponent can't afford a 1-cost unit with 3 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(false)
      .WithActivePlayer(2)
      .FillResourcesForPlayer(2, TIE, 3)
      .WithCardInHandForPlayer(2, TIE)
      .Build());

    await g.playCardFromHandAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(1);
  });

  it("control: with him ready the same play goes through", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true)
      .WithActivePlayer(2)
      .FillResourcesForPlayer(2, TIE, 3)
      .WithCardInHandForPlayer(2, TIE)
      .Build());

    await g.playCardFromHandAsync(2, 0);

    expect(g.state.player2.spaceArena).toHaveLength(1);
  });

  it("attacking exhausts him, which switches the tax on", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(true).Build());
    const before = playCost(g.state, 2, TIE);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(playCost(g.state, 2, TIE)).toBe(before + 3);
  });
});
