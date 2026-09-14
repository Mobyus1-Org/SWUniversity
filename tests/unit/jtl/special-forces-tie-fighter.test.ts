import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_135 Special Forces TIE Fighter (2/3 Space, cost 2, Aggression/Villainy)
//   "When Played: If an opponent controls more space units than you, ready this unit."
// The TIE is already in play when the ability resolves, so it counts on your side.

const TIE = Cards.units.jtl.specialForcesTieFighter;
const WING = Cards.units.jtl.phoenixSquadronAWing; // plain space unit

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, TIE);
}

function tieOf(g: GameTestAdapter) {
  return g.state.player1.spaceArena.find(u => u.cardId === TIE)!;
}

describe("JTL_135 Special Forces TIE Fighter", () => {
  it("readies when the opponent controls more space units (2 vs the TIE alone)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, WING).WithSpaceUnitForPlayer(2, WING).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(tieOf(g).ready).toBe(true);
  });

  it("stays exhausted on a tie — 1 enemy space unit vs the TIE itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, WING).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(tieOf(g).ready).toBe(false);
  });

  it("counts only space units: enemy ground units don't make it ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(tieOf(g).ready).toBe(false);
  });

  it("counts your other space units too (2 enemy vs TIE + 1 friendly → exhausted)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithSpaceUnitForPlayer(1, WING)
      .WithSpaceUnitForPlayer(2, WING).WithSpaceUnitForPlayer(2, WING)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(tieOf(g).ready).toBe(false);
  });
});
