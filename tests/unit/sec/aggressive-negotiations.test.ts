import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_179 Aggressive Negotiations (Event, cost 3) —
// "Attack with a unit. For this attack, it gets +1/+0 for each card in your hand."
//
// The buff is read AFTER the event leaves hand, so the count is whatever remains at attack time.
function setup(extraCardsInHand: number) {
  let builder = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.sec.aggressiveNegotiations)
    // 3/3 attacker, so any buff is visible in the damage dealt to the base.
    .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine);

  for (let i = 0; i < extraCardsInHand; i++) {
    builder = builder.WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine);
  }

  const g = new GameTestAdapter();
  g.loadNewState(builder.Build());
  return g;
}

describe("SEC_179 Aggressive Negotiations", () => {
  it("attacks with the chosen unit and adds +1/+0 per card left in hand", async () => {
    const g = setup(2); // event + 2 others; after playing the event, 2 remain

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Battlefield Marine is 3 power, +2 for the two cards still in hand.
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("adds nothing when the hand is empty after playing it", async () => {
    const g = setup(0);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  // The control: without the event the same unit hits for its printed power.
  it("a plain attack by the same unit deals only its printed power", async () => {
    const g = setup(2);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("prompts for an attacker", async () => {
    const g = setup(2);
    const res = await g.playCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });
});
