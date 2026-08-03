import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";

// LOF_234 Darth Malak - Covetous Apprentice (4/7 Ground, cost 5) —
//   "Overwhelm
//    When Played: If you control a Sith leader unit, you may ready this unit."
describe("LOF_234 Darth Malak - Covetous Apprentice", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.lof.darthMalak)
      .WithActivePlayer(1);
  }

  const malak = (g: GameTestAdapter) =>
    g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.darthMalak)!;

  it("has Overwhelm", () => {
    expect(HasOverwhelm(Cards.units.lof.darthMalak)).toBe(true);
  });

  it("Overwhelm: excess combat damage spills to the opponent's base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthMalak)
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1/1
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.base.damage).toBe(3); // 4 power − 1 HP
  });

  it("When Played: readies him when you control a Sith leader unit and accept", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.sor.darthVader, true, true) // Darth Vader — Sith, deployed
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.darthVader)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(malak(g).ready).toBe(true);
  });

  it("declining leaves him exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.sor.darthVader, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.darthVader)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(malak(g).ready).toBe(false);
  });

  it("control: a Sith leader still in the LEADER ZONE is not a leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build()); // Vader undeployed

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(malak(g).ready).toBe(false);
  });

  it("control: a NON-Sith leader unit does not satisfy the condition", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.sor.grandMoffTarkin, true, true) // Imperial, not Sith
        .WithGroundUnitForPlayer(1, Cards.leaders.sor.grandMoffTarkin)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(malak(g).ready).toBe(false);
  });

  it("control: an ENEMY Sith leader unit does not satisfy 'you control'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .TheirLeader(Cards.leaders.sor.darthVader, true, true)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.darthVader)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(malak(g).ready).toBe(false);
  });

  it("a friendly non-leader Sith UNIT does not satisfy 'Sith leader unit'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.sithLegionnaire) // Sith, but not a leader
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
