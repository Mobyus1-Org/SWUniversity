import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_014 Admiral Trench — Chk-chk-chk-chk (Ground leader)
// Leader:   "Action [Exhaust]: Discard a card that costs 3 or more from your hand. If you do, draw a card."
//           "Action [3 resources, Exhaust]: If you control 6 or more resources, deploy this leader."
// Deployed: "When Deployed: Reveal the top 4 cards of your deck. An opponent discards 2 of them.
//            Draw 1 of the remaining cards and discard the other."

const COST4 = Cards.units.sor.gamorreanGuards;   // cost 4
const COST2 = Cards.units.sor.battlefieldMarine;  // cost 2
const COST5 = Cards.units.sor.snowspeeder;        // cost 5
const COST6 = Cards.units.jtl.chimaera;           // cost 6

describe("JTL_014 Admiral Trench (leader) — Action: discard a 3+ cost card, then draw", () => {
  it("discards a chosen 3+ cost card and draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralTrench)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, COST4) // [0] eligible (cost 4)
        .WithCardInHandForPlayer(1, COST2) // [1] not eligible (cost 2)
        .WithCardInDeckForPlayer(1, COST5) // a card to draw
        .WithActivePlayer(1)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // discard the cost-4 card

    expect(g.state.player1.discard.some(c => c.cardId === COST4)).toBe(true);
    expect(g.state.player1.hand.some(c => c.cardId === COST5)).toBe(true); // drew from deck
    expect(g.state.player1.hand.some(c => c.cardId === COST4)).toBe(false);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("is unavailable with no 3+ cost card in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralTrench)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInHandForPlayer(1, COST2) // cost 2 only
        .WithActivePlayer(1)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);
    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

describe("JTL_014 Admiral Trench — deploy (Action [3 resources]: 6+ resources)", () => {
  it("deploys and pays 3 with 6 resources; not with 5", async () => {
    const g6 = new GameTestAdapter();
    g6.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralTrench)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        .WithActivePlayer(1)
        .Build(),
    );
    await g6.deployLeaderAsync(1);
    expect(g6.state.player1.leader.deployed).toBe(true);
    expect(g6.state.player1.resources.filter(r => r.ready).length).toBe(3); // 6 − 3 paid

    const g5 = new GameTestAdapter();
    g5.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralTrench)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );
    await g5.deployLeaderAsync(1);
    expect(g5.state.player1.leader.deployed).toBe(false);
  });
});

describe("JTL_014 Admiral Trench (deployed) — When Deployed: reveal 4, opponent discards 2, draw 1/discard 1", () => {
  it("opponent discards 2, controller draws 1 and discards the other", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.jtl.admiralTrench)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
        // Deck top order (bottommost→topmost of the reveal): [0]=COST2 [1]=COST4 [2]=COST5 [3]=COST6
        .WithCardInDeckForPlayer(1, COST2)
        .WithCardInDeckForPlayer(1, COST4)
        .WithCardInDeckForPlayer(1, COST5)
        .WithCardInDeckForPlayer(1, COST6)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.deployLeaderAsync(1); // fires When Deployed → reveal 4
    // Opponent (player 2) discards tempIds "0" and "1".
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: ["0", "1"] });
    // Controller (player 1) draws tempId "2" (COST5); the other remaining ("3"=COST6) is discarded.
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["2"] });

    expect(g.state.player1.hand.some(c => c.cardId === COST5)).toBe(true);   // drew COST5
    expect(g.state.player1.hand.some(c => c.cardId === COST6)).toBe(false);  // COST6 not drawn
    expect(g.state.player1.discard.filter(c => [COST2, COST4, COST6].includes(c.cardId)).length).toBe(3);
    expect(g.state.player1.deck.length).toBe(0); // all 4 left the deck
  });
});
