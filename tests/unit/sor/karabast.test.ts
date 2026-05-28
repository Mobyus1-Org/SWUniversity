import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_151 Karabast", () => {
  it("friendly unit deals damage equal to damage on it plus its power to an enemy unit", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren) // Aggression+Heroism covers both aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.karabast)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // 3 power, 2 damage
      .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine) // high HP target
      .Build();
    g.loadNewState(state);

    const friendlyPlayId = state.player1.groundArena[0].playId;
    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    // Step 1: pick friendly unit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [friendlyPlayId] });
    // Step 2: pick enemy unit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // 3 (power) + 2 (damage on it) = 5 damage dealt
    expect(g.state.player2.groundArena[0].damage).toBe(5);
  });
});
