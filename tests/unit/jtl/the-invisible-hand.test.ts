import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_089 The Invisible Hand — Crawling With Vultures (Unit 6/6 Space, cost 6, Command/Villainy)
//   "When Played/When this unit completes an attack (and survives): You may search the top 8 cards
//    of your deck for a Droid unit, reveal it, and draw it. If it costs 2 or less, you may play it
//    for free. (Put the other cards on the bottom of your deck in a random order.)"

const HAND = Cards.units.jtl.invisibleHand;
const VULTURE = Cards.units.jtl.swarmingVultureDroid; // cost 2 Droid — the free play
const HYENA = Cards.units.lof.hyenaBomber;             // cost 3 Droid — drawn only
const MARINE = Cards.units.sor.battlefieldMarine;      // not a Droid
const WAYFARER = Cards.units.lof.hyperspaceWayfarer;   // 4/10 Space

function base(resources = 10) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.darthVader) // Villainy + Command base — no penalty
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

type Search = { choices?: { tempId: string; cardId: string }[] };
const choices = (g: GameTestAdapter) => (g.lastDispatchResponse?.resolutionNeeded as Search).choices ?? [];
const pick = (g: GameTestAdapter, cardId: string) => choices(g).find(c => c.cardId === cardId)!.tempId;
const ready = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("JTL_089 The Invisible Hand — When Played", () => {
  function played() {
    return base()
      .WithCardInDeckForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(1, HYENA)
      .WithCardInDeckForPlayer(1, VULTURE) // top of the deck
      .WithCardInHandForPlayer(1, HAND);
  }

  it("draws a 2-cost Droid, then plays it for free", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(played().Build());

    await g.playCardFromHandAsync(1, 0);
    const afterHand = ready(g);
    await g.chooseYesAsync(1);
    await g.chooseDeckSearchAsync(1, [pick(g, VULTURE)]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([VULTURE]);
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena.map(u => u.cardId).sort()).toEqual([HAND, VULTURE].sort());
    expect(g.state.player1.hand).toHaveLength(0);
    expect(ready(g)).toBe(afterHand); // free
  });

  it("offers only Droid UNITS from the top 8", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(played().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(choices(g).map(c => c.cardId).sort()).toEqual([HYENA, VULTURE].sort());
  });

  it("declining the free play leaves the Droid in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(played().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseDeckSearchAsync(1, [pick(g, VULTURE)]);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeTruthy();
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([VULTURE]);
    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([HAND]);
  });

  it("a Droid costing more than 2 is drawn with no free-play offer", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(played().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseDeckSearchAsync(1, [pick(g, HYENA)]);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([HYENA]);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("passing on the search leaves the deck exactly as it was", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(played().Build());
    const deckBefore = [...g.state.player1.deck.map(c => c.cardId)];

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.deck.map(c => c.cardId)).toEqual(deckBefore);
    expect(g.state.player1.hand).toHaveLength(0);
  });
});

describe("JTL_089 The Invisible Hand — completes an attack and survives", () => {
  it("offers the search after attacking — and the free play works with no resources left", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(0).WithSpaceUnitForPlayer(1, HAND).WithCardInDeckForPlayer(1, VULTURE).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(6);
    await g.chooseYesAsync(1);
    await g.chooseDeckSearchAsync(1, [pick(g, VULTURE)]);
    await g.chooseYesAsync(1);

    expect(g.state.player1.spaceArena.map(u => u.cardId).sort()).toEqual([HAND, VULTURE].sort());
  });

  it("no offer if it doesn't survive the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithSpaceUnitForPlayer(1, HAND, true, 5) // 1 HP left
        .WithSpaceUnitForPlayer(2, WAYFARER)             // hits back for 4
        .WithCardInDeckForPlayer(1, VULTURE)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.hand).toHaveLength(0);
  });
});
