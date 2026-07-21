import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_220 Remnant Lookouts (3/3 Ground, cost 3)
// "When Played: Look at an opponent's hand. You may discard a card from it. If you do, they draw a card."
//
// SHD_184 Bazine Netal has the identical When Played, so it is covered here too.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("ASH_220 Remnant Lookouts", () => {
  it("discards a chosen card from the opponent's hand and they draw a replacement", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.remnantLookouts)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithCardInDeckForPlayer(2, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("PeekHand");
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player2.discard.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    // "If you do, they draw a card" — hand size is back to 2, with the drawn card added.
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([
      Cards.units.sor.consularSecurityForce,
      Cards.units.ash.mouseDroid,
    ]);
  });

  it("may decline the discard — then the opponent draws nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.remnantLookouts)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(2, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetIndices: [] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([Cards.units.sor.battlefieldMarine]);
    expect(g.state.player2.discard).toHaveLength(0);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.ash.remnantLookouts)).toBe(true);
  });

  it("does not prompt when the opponent's hand is empty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.ash.remnantLookouts)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });

  it("SHD_184 Bazine Netal has the same When Played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.shd.bazineNetal)
        .WithCardInHandForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(2, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("PeekHand");
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player2.discard.map(c => c.cardId)).toContain(Cards.units.sor.battlefieldMarine);
    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([Cards.units.ash.mouseDroid]);
  });
});
