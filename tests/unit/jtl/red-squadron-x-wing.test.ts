import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_051 Red Squadron X-Wing (3/4 Space, cost 3) —
//   "When Played: You may deal 2 damage to this unit. If you do, draw a card."
describe("JTL_051 Red Squadron X-Wing", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker) // Vigilance/Heroism — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  function withDeck(b: GameStateBuilder, n: number) {
    for (let i = 0; i < n; i++) b = b.WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine);
    return b;
  }

  it("accepting deals 2 to itself and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      withDeck(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.jtl.redSquadronXWing),
        3,
      ).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const xwing = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.jtl.redSquadronXWing)!;
    expect(xwing.damage).toBe(2);
    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.deck.length).toBe(2);
  });

  it("declining leaves it undamaged and draws nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      withDeck(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.jtl.redSquadronXWing),
        3,
      ).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    const xwing = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.jtl.redSquadronXWing)!;
    expect(xwing.damage).toBe(0);
    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.deck.length).toBe(3);
  });

  it("the damage lands on ITSELF, not another friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      withDeck(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
          .WithCardInHandForPlayer(1, Cards.units.jtl.redSquadronXWing),
        3,
      ).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.sor.tieLnFighter)!.damage).toBe(0);
    expect(g.state.player1.spaceArena.find(u => u.cardId === Cards.units.jtl.redSquadronXWing)!.damage).toBe(2);
  });

  it("survives its own 2 damage (3/4)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      withDeck(
        base()
          .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
          .WithCardInHandForPlayer(1, Cards.units.jtl.redSquadronXWing),
        3,
      ).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.jtl.redSquadronXWing)).toBe(true);
  });
});
