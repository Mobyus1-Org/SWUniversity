import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("TWI_186 San Hill", () => {
  it("On Attack: readies no resources when no friendly units were defeated this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.twi.sanHill)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3, false) // 3 exhausted resources
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
  });

  it("On Attack: readies 1 resource per friendly unit defeated this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.twi.sanHill)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3, false) // 3 exhausted resources
      .Build();
    g.loadNewState(state);

    // Inject 2 friendly units defeated this phase
    state.roundState.cardsLeftPlayThisPhase.push(
      { fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "d1", reason: "defeated" },
      { fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "d2", reason: "defeated" },
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(2);
  });

  it("On Attack: does not ready more resources than are exhausted", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.twi.sanHill)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 1, false) // only 1 exhausted resource
      .Build();
    g.loadNewState(state);

    // 3 units defeated this phase, but only 1 exhausted resource
    state.roundState.cardsLeftPlayThisPhase.push(
      { fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "d1", reason: "defeated" },
      { fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "d2", reason: "defeated" },
      { fromPlayer: 1, cardId: Cards.units.sor.battlefieldMarine, playId: "d3", reason: "defeated" },
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(1);
  });

  it("On Attack: counts token defeats for resource readying", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.twi.sanHill)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2, false)
      .Build();
    g.loadNewState(state);

    // 1 token defeated (Battle Droid)
    state.roundState.cardsLeftPlayThisPhase.push({
      fromPlayer: 1,
      cardId: Cards.units.token.battleDroid,
      playId: "d1",
      reason: "token-defeated",
    });

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(1);
  });

  it("Exploit 3: reduces cost by 6 when 3 units sacrificed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // San Hill costs 6 (Cunning + Villainy; Dooku has Command+Villainy, so Cunning = +2 penalty → 8 total)
      // Exploit 3 = 6 reduction → 2 resources needed
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.twi.sanHill)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1);
    await g.exploitGroundUnitsAsync(1, [0, 1, 2]);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.sanHill)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
  });
});
