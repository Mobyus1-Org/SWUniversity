import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_124 Protectorate Fighter (Space, cost 3) —
// "When Played: If you control a unique unit, create a Mandalorian token."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_124 Protectorate Fighter", () => {
  it("creates a Mandalorian token when you control a unique unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.ash.boKatanKryze) // unique
        .WithCardInHandForPlayer(1, Cards.units.ash.protectorateFighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const tokens = g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.mandalorian);
    expect(tokens).toHaveLength(1);
    expect(tokens[0].upgrades.map(u => u.cardId)).toContain(Cards.upgrades.token.shield);
  });

  it("does not create a token with no unique unit in play (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not unique
        .WithCardInHandForPlayer(1, Cards.units.ash.protectorateFighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.mandalorian)).toHaveLength(0);
  });

  it("does not count Protectorate Fighter's own entry (it is not unique)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.units.ash.protectorateFighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.filter(u => u.cardId === Cards.units.token.mandalorian)).toHaveLength(0);
  });
});
