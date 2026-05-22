import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Regroup Phase — Draw", () => {
  it("both players draw 2 cards when decks have enough", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.hand.length).toBe(2);
    expect(g.state.player2.hand.length).toBe(2);
    expect(g.state.player1.deck.length).toBe(1);
    expect(g.state.player2.deck.length).toBe(1);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.gamePhase).toBe("RegroupResource");
  });

  it("player draws 1 and takes 3 base damage when deck has 1 card", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player2.hand.length).toBe(2);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("player takes 6 base damage when deck is empty", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.base.damage).toBe(6);
    expect(g.state.player2.hand.length).toBe(2);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("handles mixed: P1 draws fine, P2 draws from empty deck", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.hand.length).toBe(2);
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.hand.length).toBe(0);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("sets activePlayer to initiativePlayer after draw (when P2 holds initiative)", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithInitiativePlayerBeing(2)
      .WithActivePlayer(2)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});

    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.activePlayer).toBe(2);
  });
});

describe("Regroup Phase — Resource", () => {
  function regroupResourceSetup(p1HandCards: string[] = [], p2HandCards: string[] = []) {
    const builder = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGamePhase("RegroupResource")
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(1);
    for (const c of p1HandCards) builder.WithCardInHandForPlayer(1, c);
    for (const c of p2HandCards) builder.WithCardInHandForPlayer(2, c);
    return builder.Build();
  }

  it("active player can resource a card from hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(regroupResourceSetup(
      [Cards.units.sor.battlefieldMarine],
      [Cards.units.sor.battlefieldMarine],
    ));

    await g.regroupResourceAsync(1, 0);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.resources.length).toBe(1);
    expect(g.state.player1.resources[0].ready).toBe(false);
    expect(g.state.activePlayer).toBe(2);
  });

  it("active player can pass the resource step", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(regroupResourceSetup([Cards.units.sor.battlefieldMarine]));

    await g.passResourceAsync(1);

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.resources.length).toBe(0);
    expect(g.state.activePlayer).toBe(2);
  });

  it("non-active player is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(regroupResourceSetup([Cards.units.sor.battlefieldMarine]));

    await g.regroupResourceAsync(2, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.resources.length).toBe(0);
  });

  it("both players pass-resource → transitions to ActionPhase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(regroupResourceSetup());

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.gamePhase).toBe("ActionPhase");
  });

  it("both players resource a card → transitions to ActionPhase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(regroupResourceSetup(
      [Cards.units.sor.battlefieldMarine],
      [Cards.units.sor.battlefieldMarine],
    ));

    await g.regroupResourceAsync(1, 0);
    await g.regroupResourceAsync(2, 0);

    expect(g.state.gamePhase).toBe("ActionPhase");
    expect(g.state.player1.resources.length).toBe(1);
    expect(g.state.player2.resources.length).toBe(1);
  });

  it("rejects out-of-range handIndex", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(regroupResourceSetup([Cards.units.sor.battlefieldMarine]));

    await g.regroupResourceAsync(1, 5);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.hand.length).toBe(1);
  });

  it("rejection includes a meaningful error reason", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(regroupResourceSetup([Cards.units.sor.battlefieldMarine]));

    await g.regroupResourceAsync(2, 0);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.lastDispatchResponse?.invalidReason).toContain("not your turn");
  });
});

describe("Regroup Phase — Ready and Cleanup", () => {
  function readySetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren, false)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren, false)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, false)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2, false)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 2, false)
      .WithGamePhase("RegroupResource")
      .WithActivePlayer(1)
      .WithInitiativePlayerBeing(1)
      .Build();
  }

  it("all exhausted units are readied after regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(readySetup());

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });

  it("exhausted leaders are readied after regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(readySetup());

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player2.leader.ready).toBe(true);
  });

  it("exhausted resources are readied after regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(readySetup());

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.player1.resources.every(r => r.ready)).toBe(true);
    expect(g.state.player2.resources.every(r => r.ready)).toBe(true);
  });

  it("currentRound is incremented after regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(readySetup());

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.currentRound).toBe(2);
  });

  it("initiativeClaimed is reset after regroup", async () => {
    const g = new GameTestAdapter();
    const s = readySetup();
    s.initiativeClaimed = true;
    g.loadNewState(s);

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.initiativeClaimed).toBe(false);
  });

  it("gamePhase is ActionPhase after full regroup", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(readySetup());

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.gamePhase).toBe("ActionPhase");
  });

  it("full round-trip: action phase → both pass → draw → pass-resource → ActionPhase with correct state", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren, false)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren, false)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2, false)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithCardInDeckForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithInitiativePlayerBeing(1)
      .Build();
    g.loadNewState(s);

    // Action phase ends
    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    // Both players drew 2 — we should be in RegroupResource
    expect(g.state.gamePhase).toBe("RegroupResource");
    expect(g.state.player1.hand.length).toBe(2);

    // Both pass the resource step
    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    // Should be back in ActionPhase with everything readied
    expect(g.state.gamePhase).toBe("ActionPhase");
    expect(g.state.currentRound).toBe(2);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(g.state.player1.leader.ready).toBe(true);
    expect(g.state.player1.resources.every(r => r.ready)).toBe(true);
    expect(g.state.activePlayer).toBe(1);
  });

  it("clears Phase-duration currentEffects after regroup", async () => {
    const g = new GameTestAdapter();
    const s = readySetup();
    s.currentEffects.push({
      cardId: "SOR_103",
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: "1",
    });
    g.loadNewState(s);

    await g.passResourceAsync(1);
    await g.passResourceAsync(2);

    expect(g.state.currentEffects.length).toBe(0);
  });
});
