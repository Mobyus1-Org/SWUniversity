import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_030 Death Trooper (3/3 Ground, cost 3) — a reprint of SOR_033.
//   "When Played: Deal 2 damage to a friendly ground unit and 2 damage to an enemy ground unit."
describe("SHD_030 Death Trooper", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.darthVader) // Villainy/Vigilance — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("When Played: deals 2 to a chosen friendly ground unit and 2 to a chosen enemy ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.deathTrooperShd)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // friendly Marine
    await g.chooseGroundUnitAsync(2, 0); // enemy Marine

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    // The Death Trooper himself entered undamaged.
    expect(g.state.player1.groundArena.find(u => u.cardId === Cards.units.shd.deathTrooperShd)?.damage).toBe(0);
  });

  it("may pick itself as the friendly ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.deathTrooperShd)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    // The Trooper is the only friendly ground unit, so he is the friendly target.
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("fizzles entirely when the opponent controls no ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.shd.deathTrooperShd)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // No enemy ground unit → the whole ability is skipped, so the friendly Marine is unharmed.
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
