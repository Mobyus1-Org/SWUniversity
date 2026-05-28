import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

describe("Token Creation", () => {
  // ---------------------------------------------------------------------------
  // Auto-resolve events
  // ---------------------------------------------------------------------------

  it("should create 2 Battle Droid tokens when Droid Deployment is played", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)  // cost 2 + Villainy penalty 2
      .WithCardInHandForPlayer(1, Cards.events.twi.droidDeployment)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.length).toBe(2);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.token.battleDroid);
    expect(g.state.player1.groundArena[1].cardId).toBe(Cards.units.token.battleDroid);
  });

  it("should create 2 Clone Trooper tokens when Drop In is played", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.twi.dropIn)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.length).toBe(2);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.token.cloneTrooper);
    expect(g.state.player1.groundArena[1].cardId).toBe(Cards.units.token.cloneTrooper);
  });

  it("should create 2 X-Wing tokens when Dedicated Wingmen is played", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.jtl.dedicatedWingmen)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.length).toBe(2);
    expect(g.state.player1.spaceArena[0].cardId).toBe(Cards.units.token.xWing);
    expect(g.state.player1.spaceArena[1].cardId).toBe(Cards.units.token.xWing);
  });

  it("should create 5 Spy tokens when I Am The Senate is played", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)  // cost 6 + Command,Villainy penalty 2
      .WithCardInHandForPlayer(1, Cards.events.sec.iAmTheSenate)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.length).toBe(5);
    expect(g.state.player1.groundArena.every(u => u.cardId === Cards.units.token.spy)).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // Unit When Played — auto-resolve
  // ---------------------------------------------------------------------------

  it("should create 1 TIE Fighter token when Kijimi Patrollers is played", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)  // cost 2 + Villainy penalty 2
      .WithCardInHandForPlayer(1, Cards.units.jtl.kijimiPatrollers)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);

    // kijimiPatrollers is in space, token goes to space
    const spaceUnits = g.state.player1.spaceArena;
    const tieFighters = spaceUnits.filter(u => u.cardId === Cards.units.token.tieFighter);
    expect(tieFighters.length).toBe(1);
  });

  // ---------------------------------------------------------------------------
  // Target-selection token events
  // ---------------------------------------------------------------------------

  it("should give a Shield token to the chosen unit when Moment of Peace is played", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)  // cost 1 + Vigilance penalty 2
      .WithCardInHandForPlayer(1, Cards.events.sor.momentOfPeace)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const unit = g.state.player1.groundArena[0];
    expect(unit.upgrades.length).toBe(1);
    expect(unit.upgrades[0].cardId).toBe(Cards.upgrades.token.shield);
  });

  // ---------------------------------------------------------------------------
  // Unit When Played — target selection
  // ---------------------------------------------------------------------------

  it("should give 2 Experience tokens to the chosen friendly Rebel unit when Wing Leader is played", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.wingLeader)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // Rebel unit at index 0
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    // Wing Leader itself enters at index 1; battlefieldMarine (Rebel) is at index 0
    await g.chooseGroundUnitAsync(1, 0);

    const target = g.state.player1.groundArena[0];
    expect(target.upgrades.length).toBe(2);
    expect(target.upgrades.every(u => u.cardId === Cards.upgrades.token.experience)).toBe(true);
  });
});

describe("Token Unit Removal", () => {
  it("does not go to discard pile when defeated by combat", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.token.spy)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena.length).toBe(0);
    expect(g.state.player2.groundArena.length).toBe(1);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player1.discard.length).toBe(0);
  });

  it("does not go to discard pile when defeated by bounce", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.waylay)
      .WithGroundUnitForPlayer(2, Cards.units.token.spy)
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player2.hand.length).toBe(0);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.discard.length).toBe(0);
  });
});

describe("Token Upgrade Removal", () => {
  it("does not go to discard pile when defeated by combat", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena.length).toBe(1);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.discard.length).toBe(0);
    expect(g.state.player2.discard.length).toBe(1);
  });

  it("does not go to discard pile when defeated by bounce", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.yellow30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.events.sor.waylay)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithUpgradesOnGroundUnitForPlayer(2, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.token.shield, 1),
      ])
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.hand.length).toBe(0);
    expect(g.state.player2.hand.length).toBe(1);
    expect(g.state.player2.groundArena.length).toBe(0);
    expect(g.state.player2.discard.length).toBe(0);
  });
});
