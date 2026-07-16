import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_218 Ferry Droid (1/5 Ground, cost 3) —
//   "When Played: Give 4 Advantage tokens to this unit."
describe("ASH_218 Ferry Droid", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
  }

  it("gives itself 4 Advantage tokens when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.ash.ferryDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const droid = g.state.player1.groundArena.find(u => u.cardId === Cards.units.ash.ferryDroid)!;
    expect(droid.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(4);
    // Advantage is +1/+0 each — printed power 1 + 4 = 5.
    expect(Unit.FromInterface(droid).CurrentPower()).toBe(5);
  });

  it("does not give tokens to a different friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.ash.ferryDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(marine.upgrades).toHaveLength(0);
  });
});
