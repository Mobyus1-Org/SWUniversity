import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_245 Medal Ceremony — Event (Heroism), cost 0
// "Give an Experience token to each of up to 3 REBEL units that attacked this phase."

describe("SOR_245 Medal Ceremony", () => {
  it("prompts to choose from Rebel units that attacked this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.medalCeremony)
      .Build();
    g.loadNewState(state);
    const marine = state.player1.groundArena[0];
    state.roundState.unitsAttackedThisPhase.push({
      fromPlayer: 1,
      cardId: marine.cardId,
      playId: marine.playId,
    });

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
  });

  it("gives XP to chosen Rebel units that attacked", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .WithCardInHandForPlayer(1, Cards.events.sor.medalCeremony)
      .Build();
    g.loadNewState(state);
    const marine = state.player1.groundArena[0];
    state.roundState.unitsAttackedThisPhase.push({
      fromPlayer: 1,
      cardId: marine.cardId,
      playId: marine.playId,
    });

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine.playId] });

    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === "SOR_T01")).toBe(true);
  });

  it("auto-resolves when no Rebel units attacked this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithCardInHandForPlayer(1, Cards.events.sor.medalCeremony)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });
});
