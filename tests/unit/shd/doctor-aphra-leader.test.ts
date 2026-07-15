import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_015 Doctor Aphra — Rapacious Archaeologist
// Leader:   "When the regroup phase starts: Discard a card from your deck."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// Deployed: "While there are 5 or more different costs among cards in your discard pile, this unit
//            gets +3/+0."
//           "When Deployed: Choose 3 cards in your discard pile with different names. If you do,
//            return 1 of them at random to your hand."
//
// Five cards with distinct costs: SOR_188 (1), TWI_158 (2), SOR_192 (3), SOR_014 (4), SOR_146 (5).

const FIVE_DISTINCT_COSTS = [
  Cards.units.sor.chopper,            // SOR_188, cost 1
  Cards.units.twi.cloneHeavyGunner,   // TWI_158, cost 2
  Cards.units.sor.ezraBridger,        // SOR_192, cost 3
  Cards.leaders.sor.sabineWren,       // SOR_014, cost 4 (used as a discard card)
  Cards.units.sor.zebOrrelios,        // SOR_146, cost 5
];

describe("SHD_015 Doctor Aphra — leader: discard a card from your deck when regroup starts", () => {
  it("discards the top card of the deck at the start of the regroup phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.doctorAphra)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine) // 5 cards
        .Build(),
    );

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    // 5 in deck − 1 discarded (Aphra) − 2 drawn = 2 left; discard has the 1 Aphra tossed.
    expect(g.state.player1.discard.length).toBe(1);
    expect(g.state.player1.deck.length).toBe(2);
  });

  it("does not discard for a non-Aphra leader (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.discard.length).toBe(0);
    expect(g.state.player1.deck.length).toBe(3); // only the 2 drawn
  });
});

describe("SHD_015 Doctor Aphra — deployed aura (+3/+0 while 5+ different costs in your discard)", () => {
  function deployedWithDiscard(discardCards: string[]) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.doctorAphra, true, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.doctorAphra); // deployed Aphra 2/5
    discardCards.forEach(c => b.WithCardInDiscardForPlayer(1, c));
    return b;
  }

  it("gets +3/+0 with 5 different costs in the discard pile", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedWithDiscard(FIVE_DISTINCT_COSTS).Build());

    const aphra = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(aphra.CurrentPower()).toBe(5); // 2 + 3
  });

  it("no buff with only 4 different costs", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedWithDiscard(FIVE_DISTINCT_COSTS.slice(0, 4)).Build());

    const aphra = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(aphra.CurrentPower()).toBe(2); // no aura
  });
});

describe("SHD_015 Doctor Aphra — When Deployed (choose 3 different-named discard cards, return 1 at random)", () => {
  it("returns one of the three chosen cards to hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.doctorAphra)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.chopper)       // distinct name
        .WithCardInDiscardForPlayer(1, Cards.units.sor.ezraBridger)   // distinct name
        .WithCardInDiscardForPlayer(1, Cards.units.sor.zebOrrelios)   // distinct name
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );

    const names = [Cards.units.sor.chopper, Cards.units.sor.ezraBridger, Cards.units.sor.zebOrrelios];
    const ids = g.state.player1.discard.filter(d => names.includes(d.cardId)).map(d => d.playId);

    await g.deployLeaderAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ids });

    expect(g.state.player1.hand.length).toBe(1);
    expect(names).toContain(g.state.player1.hand[0].cardId);
    expect(g.state.player1.discard.length).toBe(2); // 2 of the 3 remain
  });

  it("does not prompt when fewer than 3 different names are in the discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.doctorAphra)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.chopper)
        .WithCardInDiscardForPlayer(1, Cards.units.sor.chopper) // same name
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.leader.deployed).toBe(true);
  });
});
