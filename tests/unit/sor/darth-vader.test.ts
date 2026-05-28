import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_087 Darth Vader — When Played deck search", () => {
  it("plays a chosen Villainy unit with cost ≤ 3 for free", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInDeckForPlayer(1, Cards.units.sor.cellBlockGuard) // Villainy, cost 3
      .WithCardInHandForPlayer(1, Cards.units.sor.darthVader)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    // Darth Vader has both Ambush and When Played — trigger-order is presented
    await g.chooseOptionAsync(1, "Darth Vader — When Played");
    // DeckSearch pending: tempId "vs-0" = Cell Block Guard
    await g.chooseDeckSearchAsync(1, ["0"]);

    expect(g.state.player1.groundArena.length).toBe(2);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sor.cellBlockGuard)).toBe(true);
  });

  it("fizzles when no eligible Villainy units in top 10", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // Heroism, not Villainy
      .WithCardInHandForPlayer(1, Cards.units.sor.darthVader)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    // WP fizzles (no eligible units) — trigger-order still presented but WP auto-resolves, leaving Ambush
    await g.chooseOptionAsync(1, "Darth Vader — When Played");
    // Ambush prompt appears next; skip it
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena.length).toBe(1); // only Vader
  });

  it("plays nothing when player passes the deck search", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInDeckForPlayer(1, Cards.units.sor.cellBlockGuard)
      .WithCardInHandForPlayer(1, Cards.units.sor.darthVader)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Darth Vader — When Played");
    await g.chooseDeckSearchAsync(1, []); // pass — choose nothing
    // Ambush trigger still in bag; skip it
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena.length).toBe(1); // only Vader
    // Cell Block Guard returned to bottom of deck
    expect(g.state.player1.deck.length).toBe(1);
  });
});
