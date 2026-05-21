import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Bounty — defeat", () => {
  it("opponent collects draw-card bounty when unit is defeated", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
      .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.deck.length).toBe(0);
  });

  it("opponent may decline the bounty when unit is defeated", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
      .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.deck.length).toBe(1);
  });
});

describe("Bounty — multiple bounties", () => {
  it("two bounties on one unit resolve sequentially: draw-card then give-shield", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Wampa: 5 power / 4 HP. Give it 4 pre-existing damage so HE's 4 power kills it.
      // HE: 4 power / 1 HP. Wampa's 5 power kills it. Both die simultaneously.
      .WithGroundUnitForPlayer(1, Cards.units.sor.wampa, true, 4)
      .WithGroundUnitForPlayer(1, Cards.units.shd.recklessGunslinger)
      .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.publicEnemy, 2),
      ])
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);    // Wampa attacks
    await g.chooseGroundUnitAsync(2, 0);         // target HE — both die

    // First bounty: draw-card (Hylobon Enforcer's innate bounty)
    await g.chooseYesAsync(1);
    expect(g.state.player1.hand.length).toBe(1);

    // Second bounty: give-shield (Public Enemy upgrade's bounty)
    await g.chooseYesAsync(1);
    // Now a bounty-shield-target pending: pick Reckless Gunslinger (index 0, Wampa died)
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.shd.recklessGunslinger);
    expect(g.state.player1.groundArena[0].upgrades.length).toBe(1);
    expect(g.state.player1.groundArena[0].upgrades[0].cardId).toBe(Cards.upgrades.token.shield);
  });
});

describe("Bounty — token capture (no bounty)", () => {
  it("capturing a token unit produces no bounty prompt", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);  // capture token → token is set aside, no bounty prompt

    // No choose-option should be needed — state should be complete
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].captives.length).toBe(0); // token not placed under captor
    expect(g.state.gamePhase).toBe("ActionPhase");
  });
});

describe("Bounty — capture", () => {
  it("opponent collects draw-card bounty when unit is captured", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.length).toBe(1);
    expect(g.state.player1.deck.length).toBe(0);
    expect(g.state.player1.groundArena[0].captives.length).toBe(1);
  });

  it("opponent may decline the bounty when unit is captured", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.twi.takeCaptive)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player1.deck.length).toBe(1);
    expect(g.state.player1.groundArena[0].captives.length).toBe(1);
  });
});
