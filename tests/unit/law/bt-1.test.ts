import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_173 BT-1 (2/4 Ground) —
//   "On Attack: Discard a card from your deck. If it's Aggression, you may deal 1 damage to a ground unit."
describe("LAW_173 BT-1", () => {
  // deck.pop() takes the last-pushed card as the top — that is the one discarded.
  function base(topOfDeck: string) {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithGroundUnitForPlayer(1, Cards.units.law.bt1)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy ground target
      .WithCardInDeckForPlayer(1, topOfDeck);
  }

  it("deals 1 damage to a chosen ground unit when the discarded card is Aggression (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(Cards.units.sor.fifthBrother).Build()); // Aggression card on top

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);        // attack the enemy base
    await g.chooseYesAsync(1);            // opt into the damage
    await g.chooseGroundUnitAsync(2, 0);  // target the enemy Marine

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.deck.length).toBe(0); // card was discarded
  });

  it("may decline the damage even when Aggression was discarded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(Cards.units.sor.fifthBrother).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1); // decline

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("control: no prompt or damage when the discarded card is not Aggression", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(Cards.units.sor.battlefieldMarine).Build()); // Command/Heroism, not Aggression

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.deck.length).toBe(0); // still discarded
  });
});
