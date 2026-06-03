import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_061 Guardian of the Whills
// — The first upgrade you play on this unit each round costs [1 resource] less.

describe("SOR_061 Guardian of the Whills", () => {
  it("first upgrade played on this unit each round costs 1 less", async () => {
    // Entrenched (SOR_072, cost 2, Vigilance). With Vigilance base: no aspect penalty.
    // With guardian discount: costs 1. Player has exactly 1 resource.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)      // Vigilance — covers Entrenched aspect
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
        .Build(),
    );

    // Without the guardian discount, Entrenched costs 2 — unaffordable with 1 resource.
    // With the discount, it costs 1 — exactly what the player has.
    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });

  it("second upgrade on same guardian costs full price (no double-discount per round)", async () => {
    // Pre-mark the guardian's first-upgrade slot as already used this round.
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
      .Build();

    g.loadNewState(state);

    // Mark guardian's discount as already consumed this round.
    const guardianPlayId = g.state.player1.groundArena[0].playId;
    g.state.currentEffects.push({
      cardId: "SOR_061_firstUpgradeUsed",
      duration: "Round",
      affectedPlayer: 1,
      targetPlayId: guardianPlayId,
    });

    // Player has 1 resource. Entrenched costs 2 with no discount — can't afford.
    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("discount resets at the start of the next round", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
      .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
      .Build();

    g.loadNewState(state);

    // Simulate: guardian's first-upgrade was already used in round 1.
    const guardianPlayId = g.state.player1.groundArena[0].playId;
    g.state.currentEffects.push({
      cardId: "SOR_061_firstUpgradeUsed",
      duration: "Round",
      affectedPlayer: 1,
      targetPlayId: guardianPlayId,
    });

    // Advance through regroup phase — Round-scoped effects are cleared in executeRegroupReady.
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});
    await g.passResourceAsync(1);  // no hand cards to resource after empty-deck draw
    await g.passResourceAsync(2);

    // Round 2: guardian's discount is reset. Resources are ready; add Entrenched to hand.
    g.state.player1.hand.push({ cardId: Cards.upgrades.sor.entrenched });

    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });

  it("attaching upgrade to a non-guardian unit does not consume the guardian discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
        .Build(),
    );

    // Play Entrenched (1 resource, discounted because a fresh guardian is available).
    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    // Attach to battlefield marine (index 1), NOT the guardian (index 0).
    await g.chooseGroundUnitAsync(1, 1);

    // Guardian's discount should NOT be consumed — no "firstUpgradeUsed" effect on the guardian.
    const guardianPlayId = g.state.player1.groundArena[0].playId;
    const discountConsumed = g.state.currentEffects.some(
      e => e.cardId === "SOR_061_firstUpgradeUsed" && e.targetPlayId === guardianPlayId,
    );
    expect(discountConsumed).toBe(false);
  });

  it("attaching upgrade to the guardian consumes the discount for that round", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
        .Build(),
    );

    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    await g.chooseGroundUnitAsync(1, 0); // attach to guardian

    const guardianPlayId = g.state.player1.groundArena[0].playId;
    const discountConsumed = g.state.currentEffects.some(
      e => e.cardId === "SOR_061_firstUpgradeUsed" && e.targetPlayId === guardianPlayId,
    );
    expect(discountConsumed).toBe(true);
  });

  it("guardian with lost abilities does not grant discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          { cardId: Cards.upgrades.shd.imprisoned, playId: "imprisoned1", owner: 1, controller: 1 },
        ])
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
        .Build(),
    );

    // Guardian has lost abilities (Imprisoned). Entrenched costs 2, player has 1 → can't afford.
    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("AP upgrade on another unit then AP upgrade on GotW — second is still discounted", async () => {
    // AP plays upgrade on marine (using GotW discount). GotW discount not consumed.
    // Turn passes to NP. NP passes back. AP plays upgrade on GotW → discounted.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills) // index 0
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)   // index 1
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
        .Build(),
    );

    // Play Entrenched on marine (discounted to 1 because guardian is eligible target). 1 resource left.
    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    await g.chooseGroundUnitAsync(1, 1); // marine — guardian discount NOT consumed

    // NP passes; turn returns to AP with 1 resource.
    await g.dispatchAsync(2, "pass-action", {});

    // AP plays Entrenched on GotW. Discount still fresh → costs 1. 1 resource → affordable.
    g.state.player1.hand.push({ cardId: Cards.upgrades.sor.entrenched });
    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
    await g.chooseGroundUnitAsync(1, 0); // guardian
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });

  it("NP upgrade on AP's GotW does not consume AP's discount for the same guardian", async () => {
    // NP (player 2) plays Entrenched on player 1's GotW (default targets = all units).
    // AP then plays Entrenched on their own GotW → should still be discounted.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)         // Vigilance for AP's aspect needs
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.blue30HP)      // Vigilance so NP can play Entrenched
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.guardianOfTheWhills)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1)
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 2)
        .WithCardInHandForPlayer(2, Cards.upgrades.sor.entrenched)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.entrenched)
        .WithActivePlayer(2)
        .Build(),
    );

    // NP (player 2) plays Entrenched on player 1's GotW.
    await g.dispatchAsync(2, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    await g.chooseGroundUnitAsync(1, 0); // GotW belongs to player 1

    // Turn passes to player 1. AP has 1 resource + Entrenched in hand.
    // GotW discount must still be available to player 1 (NP's attachment shouldn't consume it).
    await g.dispatchAsync(1, "play-card", { cardId: Cards.upgrades.sor.entrenched, fromZone: "Hand" });
    expect(g.lastDispatchResponse?.invalidAction).toBeUndefined();
  });
});
