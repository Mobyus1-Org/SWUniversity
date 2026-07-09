import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_085 Superlaser Technician — reprint of SOR_083, identical text.
// "When Defeated: You may put this unit into play as a resource and ready it."

async function defeatSLT(g: GameTestAdapter) {
  const sltPlayId = g.state.player1.groundArena[0].playId;
  await g.attackWithGroundUnitAsync(2, 0);
  await g.dispatchAsync(2, "choose-target", { targetPlayIds: [sltPlayId] });
}

describe("SHD_085 Superlaser Technician", () => {
  it("offers Yes/No choice when defeated", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.shd.superlaserTechnician)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);

    await defeatSLT(g);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("choosing Yes puts SLT into resources as a ready resource", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.shd.superlaserTechnician)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithActivePlayer(2)
      .Build();
    g.loadNewState(state);

    await defeatSLT(g);
    await g.chooseYesAsync(1);

    const sltResource = g.state.player1.resources.find(r => r.cardId === Cards.units.shd.superlaserTechnician);
    expect(sltResource).toBeDefined();
    expect(sltResource?.ready).toBe(true);
  });
});
