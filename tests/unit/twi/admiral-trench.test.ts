import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("TWI_086 Admiral Trench", () => {
  it("When Played: returns no pending when no units were defeated this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0); // Exploit Option fires
    await g.chooseNoAsync(1);            // Decline Exploit → Trench enters, When Played fires (no defeated) → null

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.admiralTrench)).toBe(true);
  });

  it("When Played: prompts to return units that were defeated this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    const defeatedPlayId = "9001";
    state.player1.discard.unshift({
      cardId: Cards.units.sor.battlefieldMarine,
      playId: defeatedPlayId,
      owner: 1,
      controller: 1,
      turnDiscarded: 1,
      discardEffect: "",
    });
    state.roundState.cardsLeftPlayThisPhase.push({
      fromPlayer: 1,
      cardId: Cards.units.sor.battlefieldMarine,
      playId: defeatedPlayId,
      reason: "defeated",
    });

    await g.playCardFromHandAsync(1, 0); // Exploit Option
    await g.chooseNoAsync(1);            // Decline → When Played fires → discard Target

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type === "Target" && resolution.fromZones?.includes("Discard")).toBe(true);
    expect(resolution?.type === "Target" && resolution.fromPlayIds).toContain(defeatedPlayId);
  });

  it("When Played: chosen unit from discard is returned to hand", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    const defeatedPlayId = "9001";
    state.player1.discard.unshift({
      cardId: Cards.units.sor.battlefieldMarine,
      playId: defeatedPlayId,
      owner: 1,
      controller: 1,
      turnDiscarded: 1,
      discardEffect: "",
    });
    state.roundState.cardsLeftPlayThisPhase.push({
      fromPlayer: 1,
      cardId: Cards.units.sor.battlefieldMarine,
      playId: defeatedPlayId,
      reason: "defeated",
    });

    await g.playCardFromHandAsync(1, 0); // Exploit Option
    await g.chooseNoAsync(1);            // Decline → When Played fires
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defeatedPlayId] });

    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(true);
    expect(g.state.player1.discard.some(d => d.playId === defeatedPlayId)).toBe(false);
  });

  it("When Played: player can decline and return 0 units", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    const defeatedPlayId = "9001";
    state.player1.discard.unshift({
      cardId: Cards.units.sor.battlefieldMarine,
      playId: defeatedPlayId,
      owner: 1,
      controller: 1,
      turnDiscarded: 1,
      discardEffect: "",
    });
    state.roundState.cardsLeftPlayThisPhase.push({
      fromPlayer: 1,
      cardId: Cards.units.sor.battlefieldMarine,
      playId: defeatedPlayId,
      reason: "defeated",
    });

    await g.playCardFromHandAsync(1, 0); // Exploit Option
    await g.chooseNoAsync(1);            // Decline → When Played fires
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [] }); // Return 0 units

    expect(g.state.player1.discard.some(d => d.playId === defeatedPlayId)).toBe(true);
    expect(g.state.player1.hand.some(c => c.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
  });

  it("When Played: returns up to 3 units (capped at 3 even if 4 eligible)", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    const ids = ["9001", "9002", "9003", "9004"];
    for (const id of ids) {
      state.player1.discard.unshift({
        cardId: Cards.units.sor.battlefieldMarine,
        playId: id,
        owner: 1,
        controller: 1,
        turnDiscarded: 1,
        discardEffect: "",
      });
      state.roundState.cardsLeftPlayThisPhase.push({
        fromPlayer: 1,
        cardId: Cards.units.sor.battlefieldMarine,
        playId: id,
        reason: "defeated",
      });
    }

    await g.playCardFromHandAsync(1, 0); // Exploit Option
    await g.chooseNoAsync(1);            // Decline → When Played fires

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Target");
    expect(resolution?.type === "Target" && resolution.maxTargets).toBe(3);

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["9001", "9002", "9003"] });

    expect(g.state.player1.hand.filter(c => c.cardId === Cards.units.sor.battlefieldMarine)).toHaveLength(3);
    expect(g.state.player1.discard.some(d => d.playId === "9004")).toBe(true);
  });

  it("Exploit 1: reduces cost by 2 when 1 unit sacrificed", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      // Admiral Trench costs 7 (Command + Villainy, Dooku = no penalty)
      // Exploit 1 → costs 5 after 1 unit sacrificed
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.units.twi.admiralTrench)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    await g.chooseYesAsync(1);
    await g.exploitGroundUnitsAsync(1, [0]);

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.twi.admiralTrench)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(0);
  });
});
