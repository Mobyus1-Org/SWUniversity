import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_151 Operation Cinder (Event, cost 6, Aggression/Villainy) — "Deal 5 damage to your base.
// Then, deal 5 damage to each unit."
//
// Homestead Militia (SOR_113) is 3 power / 4 HP — dies to 5 damage. Gozanti Assault Carrier
// (ASH_099) is 6 HP — survives 5 damage with 1 remaining HP, marked with damage.

describe("ASH_151 Operation Cinder", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.ash.grandAdmiralThrawn)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.ash.operationCinder);
  }

  it("deals 5 damage to the caster's own base", async () => {
    const g = new GameTestAdapter();
    const state = base().Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.base.damage).toBe(5);
  });

  it("deals 5 damage to every unit in play, both players and both arenas", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.academyDefenseWalker) // 5 hp — dies
      .WithSpaceUnitForPlayer(2, Cards.units.ash.gozantiAssaultCarrier) // 6 hp — survives with 1 remaining
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    const survivor = g.state.player2.spaceArena.find(u => u.cardId === Cards.units.ash.gozantiAssaultCarrier);
    expect(survivor?.damage).toBe(5);
  });

  it("defeats a unit whose remaining HP is 5 or less", async () => {
    const g = new GameTestAdapter();
    const state = base()
      .WithGroundUnitForPlayer(2, Cards.units.sor.homesteadMilitia) // 4 hp — dies to 5 damage
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.homesteadMilitia)).toBeUndefined();
    expect(g.state.player2.discard.some(c => c.cardId === Cards.units.sor.homesteadMilitia)).toBe(true);
  });
});
