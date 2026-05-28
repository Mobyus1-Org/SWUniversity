import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SOR_104 U-Wing Reinforcement — deck search", () => {
  it("plays one chosen unit for free", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla) // Command,Heroism — covers U-Wing's aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 3, any faction
      .WithCardInHandForPlayer(1, Cards.events.sor.uWingReinforcement)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    // DeckSearch pending: tempId "uw-0" = Battlefield Marine
    await g.chooseDeckSearchAsync(1, ["0"]);

    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.sor.battlefieldMarine);
  });

  it("plays up to 3 units with combined cost ≤ 7", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla) // Command,Heroism — covers U-Wing's aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 3
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 3
      .WithCardInHandForPlayer(1, Cards.events.sor.uWingReinforcement)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    // DeckSearch pending: "uw-0" and "uw-1" (2 × cost 3 = combined 6 ≤ 7)
    await g.chooseDeckSearchAsync(1, ["0", "1"]);

    expect(g.state.player1.groundArena.length).toBe(2);
  });

  it("fizzles when no units in top 10", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla) // Command,Heroism — covers U-Wing's aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.events.sor.uWingReinforcement)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    // No deck-search pending (empty deck) — state returned directly
    expect(g.state.player1.groundArena.length).toBe(0);
  });
});
