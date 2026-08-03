import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_078 Fell the Dragon (Event, cost 4) — "Defeat a non-leader unit with 5 or more power."
describe("SHD_078 Fell the Dragon", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("defeats an enemy non-leader unit with 5 or more power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6 power
        .WithCardInHandForPlayer(1, Cards.events.shd.fellTheDragon)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.sor.reinforcementWalker)).toBe(true);
  });

  it("can defeat a friendly unit too ('a non-leader unit', not 'an enemy unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker) // 6 power, friendly
        .WithCardInHandForPlayer(1, Cards.events.shd.fellTheDragon)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena.length).toBe(0);
  });

  it("cannot target a unit with less than 5 power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)   // 3 power — ineligible
        .WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker) // 6 power — eligible
        .WithCardInHandForPlayer(1, Cards.events.shd.fellTheDragon)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // the 3-power Marine

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena.length).toBe(2);
  });

  it("counts CURRENT power, so a buffed 3-power unit becomes a legal target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power printed
        .WithCardInHandForPlayer(1, Cards.events.shd.fellTheDragon)
        .WithCurrentEffect({ cardId: "SOR_124", duration: "Phase", affectedPlayer: 2 }) // +2/+2
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("cannot target a leader unit even at 5+ power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .TheirLeader(Cards.leaders.sor.darthVader, true, true)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.darthVader) // deployed leader
        .WithCardInHandForPlayer(1, Cards.events.shd.fellTheDragon)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // No legal target → the event fizzles with no prompt at all.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena.length).toBe(1);
  });
});
