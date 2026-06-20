import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// The infinite-Credit combo (ai-spec/feat-credit-infinite.md):
//   Sandcrawler (LAW_238) + Camtono (ASH_229) + Nowhere to Hide (ASH_198), with
//   Galen Erso (LAW_233) given to the opponent and Fly Casual (JTL_206) cycling
//   through an otherwise-empty deck. Each swing nets +1 Credit.
function buildComboState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    // Player 1: ready Sandcrawler with Camtono + Nowhere to Hide
    .WithGroundUnitForPlayer(1, Cards.units.law.scavengingSandcrawler)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [
      { cardId: Cards.upgrades.ash.camtono, playId: "@", owner: 1, controller: 1 },
      { cardId: Cards.upgrades.ash.nowhereToHide, playId: "@", owner: 1, controller: 1 },
    ])
    // Fly Casual starts in the (otherwise empty) discard pile
    .WithCardInDiscardForPlayer(1, Cards.events.jtl.flyCasual)
    // Galen Erso controlled by the opponent — the 0-power punching bag
    .WithGroundUnitForPlayer(2, Cards.units.law.galenErso)
    .Build();
}

describe("Infinite Credits combo", () => {
  it("nets +1 Credit per swing (single iteration)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildComboState());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // attack Galen
    // Galen has no Shields, so Saboteur contributes no orderable trigger; LAW_238 is the
    // lone On-Attack trigger and resolves directly (no ordering prompt).
    await g.chooseOptionAsync(1, "Yes"); // LAW_238: put discard card on deck bottom + create Credit
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.discard[0].playId] });
    await g.chooseOptionAsync(1, "Yes"); // Camtono: replay Fly Casual free
    await g.chooseGroundUnitAsync(1, 0); // Fly Casual: ready the Sandcrawler

    expect(g.state.player1.supplemental.creditTokens).toBe(1);
    expect(g.state.player1.groundArena[0].ready).toBe(true); // readied again
    expect(g.state.player2.groundArena).toHaveLength(1); // Galen survives (0 effective power)
  });

  it("can generate 100 Credits by looping the swing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(buildComboState());

    for (let i = 0; i < 100; i++) {
      await g.attackWithGroundUnitAsync(1, 0);
      await g.chooseGroundUnitAsync(2, 0); // attack Galen
      await g.chooseOptionAsync(1, "Yes"); // LAW_238: discard -> deck bottom + Credit (lone trigger, no ordering)
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.discard[0].playId] });
      await g.chooseOptionAsync(1, "Yes"); // Camtono: replay Fly Casual free
      await g.chooseGroundUnitAsync(1, 0); // Fly Casual: ready the Sandcrawler
      // Action phase alternates turns; the unit-less opponent simply passes.
      await g.dispatchAsync(2, "pass-action", {});
    }

    expect(g.state.player1.supplemental.creditTokens).toBe(100);
    expect(g.state.player2.groundArena).toHaveLength(1); // Galen never dies
  }, 30000);
});
