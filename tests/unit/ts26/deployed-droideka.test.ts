import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TS26_077 Deployed Droideka (4/3 Ground, cost 4) —
//   "Ambush (When you play this unit, it may attack an enemy unit.)
//    When Played: You may pay 2 resources. If you do, give an Experience token and a Shield token to this unit."
describe("TS26_077 Deployed Droideka", () => {
  function build() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // Ambush target
      .WithCardInHandForPlayer(1, Cards.units.ts26.deployedDroideka)
      .Build();
  }

  function droideka(g: GameTestAdapter) {
    return g.state.player1.groundArena.find(u => u.cardId === Cards.units.ts26.deployedDroideka)!;
  }

  it("When Played: pay 2 to give this unit an Experience and Shield token (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Deployed Droideka — When Played");
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.chooseYesAsync(1); // pay 2
    await g.chooseNoAsync(1);  // decline Ambush

    const d = droideka(g);
    expect(d.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(1);
    expect(d.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(1);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 2);
  });

  it("When Played: may decline the payment (no tokens, no cost)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Deployed Droideka — When Played");
    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.chooseNoAsync(1); // decline payment
    await g.chooseNoAsync(1); // decline Ambush

    const d = droideka(g);
    expect(d.upgrades.length).toBe(0);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore);
  });

  it("Ambush: may attack an enemy unit when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Deployed Droideka — Ambush");
    await g.chooseYesAsync(1); // accept Ambush
    await g.chooseGroundUnitAsync(2, 0); // attack the enemy Marine (3/3)

    // 4-power Droideka defeats the 3/3 Marine; Droideka took 3, survives (3 HP → 0 remaining but alive at 0? no: 3 HP, 3 damage).
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false);
  });
});
