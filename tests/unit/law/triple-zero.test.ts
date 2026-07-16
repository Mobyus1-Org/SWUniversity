import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_174 0-0-0 (4/4 Ground) —
//   "On Attack: You may put an Aggression card from your discard pile on the bottom of your deck.
//    If you do, deal 1 damage to each enemy base."
describe("LAW_174 0-0-0", () => {
  const AGG_PLAY_ID = "agg1";

  function base(withAggressionInDiscard: boolean) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .WithGroundUnitForPlayer(1, Cards.units.law.tripleZero)      // 4 power attacker
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine); // enemy unit to attack
    const state = b.Build();
    if (withAggressionInDiscard) {
      state.player1.discard.unshift({
        cardId: Cards.units.sor.fifthBrother, // Aggression card
        playId: AGG_PLAY_ID,
        owner: 1,
        controller: 1,
        turnDiscarded: 1,
        discardEffect: "",
      });
    }
    return state;
  }

  it("puts an Aggression card on the deck bottom and deals 1 to the enemy base (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(true));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack the enemy unit (isolates the base damage)
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [AGG_PLAY_ID] });

    expect(g.state.player2.base.damage).toBe(1);
    // Card moved from discard to the bottom of the deck.
    expect(g.state.player1.discard.some(d => d.playId === AGG_PLAY_ID)).toBe(false);
    expect(g.state.player1.deck.some(d => d.cardId === Cards.units.sor.fifthBrother)).toBe(true);
  });

  it("may decline; no base damage and the card stays in the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(true));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.discard.some(d => d.playId === AGG_PLAY_ID)).toBe(true);
  });

  it("control: no prompt when the discard holds no Aggression card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(false));

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
