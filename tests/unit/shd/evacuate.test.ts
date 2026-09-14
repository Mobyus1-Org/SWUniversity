import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_233 Evacuate (Event) — "Return each non-leader unit to its owner's hand."
//
// A Vehicle with a leader Pilot on it is a leader unit, so it stays.

describe("SHD_233 Evacuate", () => {
  it("returns non-leader units but leaves a Vehicle piloted by a leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.jtl.lukeSkywalker, false, true)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithCardInHandForPlayer(1, Cards.events.shd.evacuate)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.phoenixSquadronAWing)
        .WithUpgradesOnSpaceUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(Cards.leaders.jtl.lukeSkywalker, 2)])
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.spaceArena.map(u => u.cardId)).toEqual([Cards.units.jtl.phoenixSquadronAWing]);
  });
});
