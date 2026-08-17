import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";

// TWI_246 Tranquility — Inspiring Flagship (7/6 Space, Republic/Vehicle/Capital Ship, cost 7)
//   "When Played: You may return a Republic unit from your discard pile to your hand."
//   "On Attack: Each of the next 3 Republic cards you play this phase costs 1 resource less."
//
// Unlike the one-shot "next card costs 1 less" effects, this one is CHARGED: it pays out three
// times, and only Republic cards spend a charge.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20);
}

describe("TWI_246 Tranquility — When Played", () => {
  it("may return a Republic unit from the discard pile to hand", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.units.twi.tranquility)
      .WithCardInDiscardForPlayer(1, Cards.units.twi.stalwart332nd) // Republic
      .Build();
    g.loadNewState(state);
    const discardPlayId = g.state.player1.discard[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [discardPlayId] });

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(Cards.units.twi.stalwart332nd);
    expect(g.state.player1.discard).toHaveLength(0);
  });

  it("declining leaves the discard pile untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.twi.tranquility)
        .WithCardInDiscardForPlayer(1, Cards.units.twi.stalwart332nd)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.discard).toHaveLength(1);
  });

  it("offers only REPUBLIC units — a non-Republic unit in the discard is not eligible", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.twi.tranquility)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel, not Republic
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.discard).toHaveLength(1);
  });

  it("no prompt with an empty discard pile (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithCardInHandForPlayer(1, Cards.units.twi.tranquility).Build());

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});

describe("TWI_246 Tranquility — On Attack discount", () => {
  async function attackWithTranquility(g: GameTestAdapter) {
    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
  }

  it("makes the next Republic card cost 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.twi.tranquility)
        .WithCardInHandForPlayer(1, Cards.units.twi.stalwart332nd)
        .Build(),
    );

    await attackWithTranquility(g);

    // 332nd Stalwart costs 1; the discount takes it to 0.
    expect(playCost(g.state, 1, Cards.units.twi.stalwart332nd)).toBe(0);
  });

  it("does NOT discount non-Republic cards", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.twi.tranquility)
        .Build(),
    );

    await attackWithTranquility(g);

    // Battlefield Marine (Rebel) costs 2 and stays 2.
    expect(playCost(g.state, 1, Cards.units.sor.battlefieldMarine)).toBe(2);
  });

  it("pays out exactly 3 times — the 4th Republic card is full price", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.twi.tranquility)
        .WithCardInHandForPlayer(1, Cards.units.twi.stalwart332nd)
        .WithCardInHandForPlayer(1, Cards.units.twi.stalwart332nd)
        .WithCardInHandForPlayer(1, Cards.units.twi.stalwart332nd)
        .WithCardInHandForPlayer(1, Cards.units.twi.stalwart332nd)
        .Build(),
    );

    await attackWithTranquility(g);

    for (let i = 0; i < 3; i++) {
      expect(playCost(g.state, 1, Cards.units.twi.stalwart332nd)).toBe(0);
      await g.dispatchAsync(2, "pass-action", {}); // P1 cannot act twice in a row
      await g.playCardFromHandAsync(1, 0);
    }

    expect(playCost(g.state, 1, Cards.units.twi.stalwart332nd)).toBe(1);
  });

  it("a non-Republic card played in between does not spend a charge", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.twi.tranquility)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.twi.stalwart332nd)
        .Build(),
    );

    await attackWithTranquility(g);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // the Rebel Marine

    // All 3 charges still armed: the Republic unit is still discounted.
    expect(playCost(g.state, 1, Cards.units.twi.stalwart332nd)).toBe(0);
  });
});
