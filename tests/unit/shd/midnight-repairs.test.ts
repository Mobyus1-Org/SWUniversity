import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SHD_054 Midnight Repairs — Heal up to 8 total damage from any number of units.
// Aspects: Vigilance×Vigilance. chirrutImwe (Vigilance+Heroism) covers one; cost 2 + 2 penalty = 4 resources.

describe("SHD_054 Midnight Repairs", () => {
  it("heals a damaged unit with no rebound damage", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.shd.midnightRepairs)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 3)
      .Build();
    g.loadNewState(state);

    const marinePlayId = state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: marinePlayId, damage: 3 }],
    });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    // No source unit to receive rebound — nothing should have taken damage
    expect(g.state.player1.base.damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("heals multiple units up to 8 total", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.chirrutImwe)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.events.shd.midnightRepairs)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 4)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 3)
      .Build();
    g.loadNewState(state);

    const marine1 = state.player1.groundArena[0].playId;
    const marine2 = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: marine1, damage: 4 },
        { playId: marine2, damage: 3 },
      ],
    });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
