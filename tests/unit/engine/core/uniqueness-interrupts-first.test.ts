import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";

// General rule: the duplicate-unique defeat must ALWAYS interrupt and resolve first —
// before any of the entering unit's own effects (heals, Shielded, When Played, etc.).
describe("uniqueness rule interrupts before the entering unit's own effects", () => {
  it("Colonel Yularen (SOR_109): heal is withheld until the duplicate is defeated", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 5) // base starts with 5 damage
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 6)
      .WithGroundUnitForPlayer(1, Cards.units.sor.colonelYularen) // existing copy
      .WithCardInHandForPlayer(1, Cards.units.sor.colonelYularen)  // second copy
      .Build();
    g.loadNewState(state);

    expect(g.state.player1.base.damage).toBe(5);

    await g.playCardFromHandAsync(1, 0);

    // Uniqueness interrupts FIRST — Yularen's "heal on Command unit played" must not
    // have fired yet.
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Target");
    expect(g.state.player1.base.damage).toBe(5);

    // Defeat one copy; only now does the surviving Yularen's heal resolve.
    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.base.damage).toBe(4);
    expect(
      g.state.player1.groundArena.filter(u => u.cardId === Cards.units.sor.colonelYularen).length,
    ).toBe(1);
  });

  it("R2-D2 (SOR_236) via U-Wing Reinforcement: playing two copies triggers the uniqueness defeat", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.heraSyndulla) // Command,Heroism — covers U-Wing's aspects
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInDeckForPlayer(1, Cards.units.sor.r2d2) // cost 1
      .WithCardInDeckForPlayer(1, Cards.units.sor.r2d2) // cost 1
      .WithCardInHandForPlayer(1, Cards.events.sor.uWingReinforcement)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    // DeckSearch: pick both R2-D2 (combined cost 2 ≤ 7)
    await g.chooseDeckSearchAsync(1, ["0", "1"]);

    // Both R2-D2 entered play — uniqueness must interrupt to defeat one.
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Target");

    // Defeat one copy.
    await g.chooseGroundUnitAsync(1, 0);

    // Exactly one R2-D2 may remain in play.
    expect(
      g.state.player1.groundArena.filter(u => u.cardId === Cards.units.sor.r2d2).length,
    ).toBe(1);
  });
});
