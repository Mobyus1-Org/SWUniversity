import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_181 Planetary Bombardment (Event, cost 6) —
//   "Deal 8 indirect damage to a player. If you control a Capital Ship unit, deal 12 indirect
//    damage instead."
describe("JTL_181 Planetary Bombardment", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 18)
      .WithCardInHandForPlayer(1, Cards.events.jtl.planetaryBombardment)
      .WithActivePlayer(1);
  }

  it("deals 8 without a Capital Ship", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    expect(g.state.player2.base.damage).toBe(8);
  });

  it("deals 12 instead while you control a Capital Ship", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, Cards.units.jtl.chimaera).Build()); // Capital Ship

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });

    expect(g.state.player2.base.damage).toBe(12);
  });

  it("an ENEMY Capital Ship does not count — it is 'you control'", async () => {
    const g = new GameTestAdapter();
    const s = base().WithSpaceUnitForPlayer(2, Cards.units.jtl.chimaera).Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 8 }],
    });

    expect(g.state.player2.base.damage).toBe(8);
  });

  it("may be aimed at yourself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Yourself" });

    expect(g.state.player1.base.damage).toBe(8);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("the victim divides it among their units and base", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 4/10
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-option", { option: "Opponent" });
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [
        { playId: s.player2.groundArena[0].playId, damage: 6 },
        { playId: "player2.base", damage: 2 },
      ],
    });

    expect(g.state.player2.groundArena[0].damage).toBe(6);
    expect(g.state.player2.base.damage).toBe(2);
  });
});
