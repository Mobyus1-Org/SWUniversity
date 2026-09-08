import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_245 Greef Karga — Affable Commissioner (2/2 Ground, cost 2, Heroism, Fringe/Official) —
//   "When Played: Search the top 5 cards of your deck for an upgrade, reveal it, and draw it."
//
// Same shape as SOR_123 Recruit with the filter changed from Unit to Upgrade, so this is a
// one-liner — but the filter is the whole card, and a wrong one is invisible until someone runs
// a deck with a non-upgrade on top.

const GREEF = "SHD_245";
const UPGRADE = Cards.upgrades.sor.electrostaff ?? "SOR_166";
const MARINE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, GREEF)
    .WithActivePlayer(1);
}

describe("SHD_245 Greef Karga", () => {
  it("draws an upgrade from the top 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDeckForPlayer(1, UPGRADE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseDeckSearchAsync(1, ["0"]);

    expect(g.state.player1.hand.map(c => c.cardId)).toContain(UPGRADE);
  });

  it("offers only UPGRADES, not units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithCardInDeckForPlayer(1, MARINE)
        .WithCardInDeckForPlayer(1, UPGRADE)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const pending = g.lastDispatchResponse?.resolutionNeeded ?? null;
    expect(pending?.type).toBe("DeckSearch");
    if (pending?.type === "DeckSearch") {
      expect(pending.choices.map(c => c.cardId)).toEqual([UPGRADE]);
    }
  });

  it("asks nothing when the top 5 hold no upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithCardInDeckForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
