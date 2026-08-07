import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasPlot } from "@/server/engine/card-db/keyword-dictionaries.ts/plot";
import { CardTitle } from "@/server/engine/card-db/generated";
import type { NeedsPeekHand, NeedsTarget } from "@/lib/engine/message-types";

// SEC_186 Garindan - Information Broker (1/3 Ground, cost 2, Cunning/Villainy, Underworld, unique)
//   "When Played: Name a card. Look at an opponent's hand and discard a card with that name from it.
//    Plot (When you deploy a leader, you may play this card from your resources, paying its cost.
//    Replace it with the top card of your deck.)"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sec.drydenVos) // Cunning/Villainy — covers Garindan's aspects
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.sec.garindan);
}

const MARINE = Cards.units.sor.battlefieldMarine;
const CONSULAR = Cards.units.sor.consularSecurityForce;

describe("SEC_186 Garindan — When Played", () => {
  it("names a card the opponent holds and discards it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, CONSULAR)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // Step 1 — the name prompt offers card titles, not playIds.
    const namePrompt = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(namePrompt.type).toBe("Target");
    expect(namePrompt.fromChoices).toContain(CardTitle(MARINE));
    // The prompt must say what naming a card DOES — the client used to hardcode Regional
    // Governor's explanation on every name-a-card prompt, which was wrong for every other card.
    expect(namePrompt.helperText).toBe("You may discard a card from your opponent's hand with that name.");

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(MARINE)] });

    // Step 2 — the opponent's hand is shown, with only the named card discardable.
    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.type).toBe("PeekHand");
    expect(peek.targetPlayer).toBe(2);
    expect(peek.mustDiscard).toBe(true);
    expect(peek.eligibleIndices).toEqual([0]); // the Marine only

    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([CONSULAR]);
    expect(g.state.player2.discard.map(c => c.cardId)).toEqual([MARINE]);
  });

  it("offers only the named card when the opponent holds a mix", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(2, CONSULAR)
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, CONSULAR)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(CONSULAR)] });

    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.eligibleIndices).toEqual([0, 2]); // both Consulars, not the Marine
  });

  it("discards exactly one copy when the opponent holds several", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(MARINE)] });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player2.hand).toHaveLength(1);
    expect(g.state.player2.discard).toHaveLength(1);
  });

  it("control: naming a card they don't hold discards nothing, but still shows the hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(2, MARINE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(CONSULAR)] });

    // "Look at an opponent's hand" still happens — the peek is the payoff on a miss.
    const peek = g.lastDispatchResponse!.resolutionNeeded as NeedsPeekHand;
    expect(peek.type).toBe("PeekHand");
    expect(peek.mustDiscard).toBe(false);

    await g.dispatchAsync(1, "choose-target", {});

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]); // untouched
    expect(g.state.player2.discard).toHaveLength(0);
  });

  it("rejects discarding a card that was not the named one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(2, MARINE)
        .WithCardInHandForPlayer(2, CONSULAR)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(MARINE)] });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [1] }); // the Consular

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.hand).toHaveLength(2); // nothing discarded
  });

  it("resolves without stranding a prompt when the opponent's hand is empty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(MARINE)] });

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sec.garindan)).toBe(true);
  });
});

describe("SEC_186 Garindan — Plot", () => {
  it("has the Plot keyword", () => {
    expect(HasPlot(Cards.units.sec.garindan)).toBe(true);
  });

  it("can be played from resources when a leader deploys", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sec.drydenVos)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, MARINE, 10)
        .FillResourcesForPlayer(1, Cards.units.sec.garindan, 1) // resource index 10
        .WithCardInHandForPlayer(2, MARINE)
        .Build(),
    );

    await g.deployLeaderAsync(1);
    await g.choosePlotCardAsync(1, 10);
    // Garindan enters via Plot and its When Played runs.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [CardTitle(MARINE)] });
    await g.dispatchAsync(1, "choose-target", { targetIndices: [0] });

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.sec.garindan)).toBe(true);
    expect(g.state.player2.hand).toHaveLength(0);
  });
});
