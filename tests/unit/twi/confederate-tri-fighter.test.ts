import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_132 Confederate Tri-Fighter (3/3 Space) — "Bases can't be healed."
// A static ability affecting every base while a Tri-Fighter is in play.
describe("TWI_132 Confederate Tri-Fighter", () => {
  function base(withTriFighter: boolean, baseDamage = 5) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, baseDamage)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP, baseDamage)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.events.sor.repair); // "Heal 3 from a unit or base"
    if (withTriFighter) b.WithSpaceUnitForPlayer(1, Cards.units.twi.confederateTriFighter);
    return b.Build();
  }

  it("prevents a friendly base from being healed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(true));

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] }); // try to heal my own base

    expect(g.state.player1.base.damage).toBe(5); // unchanged
  });

  it("control: a base heals normally when no Tri-Fighter is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(false));

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: ["player1.base"] });

    expect(g.state.player1.base.damage).toBe(2); // 5 - 3
  });

  it("still allows healing a unit (only bases are blocked)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithSpaceUnitForPlayer(1, Cards.units.twi.confederateTriFighter)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true, 2) // 2 damage
        .WithCardInHandForPlayer(1, Cards.events.sor.repair)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // heal the damaged Marine

    expect(g.state.player1.groundArena[0].damage).toBe(0); // healed
  });
});
