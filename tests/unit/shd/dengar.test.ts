import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_133 Dengar - The Demolisher (Unit, cost 1, 2/2 Ground, Underworld Bounty Hunter)
// "When you play an upgrade on a unit: You may deal 1 damage to that unit."
//
// "you play" — only Dengar's controller playing an upgrade triggers him.
// "on a unit" — any unit, friendly or enemy.
// "that unit" — the unit the upgrade attached to, not Dengar.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 14);
}

describe("SHD_133 Dengar", () => {
  it("deals 1 damage to the unit an upgrade was played on when accepted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.shd.dengar)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1); // attach to the Marine

    await g.chooseYesAsync(1);

    const marine = g.state.player1.groundArena[1];
    expect(marine.cardId).toBe(Cards.units.sor.battlefieldMarine);
    expect(marine.damage).toBe(1);
    expect(g.state.player1.groundArena[0].damage).toBe(0); // Dengar himself is untouched
  });

  it("deals no damage when declined", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.shd.dengar)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1);

    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[1].damage).toBe(0);
  });

  it("triggers when the upgrade is played on an ENEMY unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.shd.dengar)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.shd.imprisoned)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    await g.chooseYesAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("can damage Dengar himself when the upgrade is played on him", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.shd.dengar)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    await g.chooseYesAsync(1);

    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("does NOT trigger when the OPPONENT plays the upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.shd.dengar)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(2, Cards.upgrades.sor.academyTraining)
        .Build(),
    );

    await g.dispatchAsync(1, "pass-action", {});
    await g.playCardFromHandAsync(2, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does not fire without Dengar in play (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("does not fire while Dengar has lost his abilities", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.shd.dengar)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
      .Build();
    // Imprisoned (SHD_072) on Dengar — he loses all abilities.
    state.player1.groundArena[0].upgrades.push({
      cardId: Cards.upgrades.shd.imprisoned,
      playId: "9001",
      owner: 2,
      controller: 2,
    });
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[1].damage).toBe(0);
  });
});
