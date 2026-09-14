import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_158 Crackshot V-Wing (2/2 Space, cost 1, Aggression)
//   "When Played: If you control no other Fighter units, deal 1 damage to this unit."

const VWING = Cards.units.jtl.crackshotVWing;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, VWING);
}

function vwingOf(g: GameTestAdapter) {
  return g.state.player1.spaceArena.find(u => u.cardId === VWING)!;
}

describe("JTL_158 Crackshot V-Wing", () => {
  it("deals 1 damage to itself when you control no other Fighter", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(vwingOf(g).damage).toBe(1);
  });

  it("takes no damage when you control another Fighter unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(vwingOf(g).damage).toBe(0);
  });

  it("a Fighter token (TIE Fighter) counts as another Fighter", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, Cards.units.token.tieFighter).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(vwingOf(g).damage).toBe(0);
  });

  it("an enemy Fighter or a friendly non-Fighter doesn't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.landingShuttle)
      .Build());

    await g.playCardFromHandAsync(1, 0);

    expect(vwingOf(g).damage).toBe(1);
  });
});
