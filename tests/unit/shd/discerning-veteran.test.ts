import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_120 Discerning Veteran (3/4 Ground, cost 5) —
//   "When Played: This unit captures an enemy non-leader ground unit."
describe("SHD_120 Discerning Veteran", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("captures the chosen enemy ground unit under itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.discerningVeteran)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    const veteran = g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.discerningVeteran)!;
    expect(veteran.captives.length).toBe(1);
    expect(veteran.captives[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
  });

  it("cannot capture an enemy SPACE unit — the Veteran is a ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .WithCardInHandForPlayer(1, Cards.units.shd.discerningVeteran)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // No eligible ground victim → no prompt, and the space unit is untouched.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.spaceArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].captives.length).toBe(0);
  });

  it("cannot capture an enemy leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .TheirLeader(Cards.leaders.sor.sabineWren, true, true)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, Cards.units.shd.discerningVeteran)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena.length).toBe(1);
  });

  it("the captive returns to its owner's arena when the Veteran leaves play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.discerningVeteran)
        .WithCardInHandForPlayer(1, Cards.events.shd.rivalsFall)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // Rival's Fall the Veteran — its captive is released.
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    const veteranIdx = g.state.player1.groundArena.findIndex(u => u.cardId === Cards.units.shd.discerningVeteran);
    await g.chooseGroundUnitAsync(1, veteranIdx);

    expect(g.state.player2.groundArena.length).toBe(1);
    expect(g.state.player2.groundArena[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
  });
});
