import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// JTL_237 TIE Bomber (-/4 Space, cost 2, Villainy) —
//   "On Attack: Deal 3 indirect damage to the defending player."
// Same text as JTL_149 Red Squadron Y-Wing. It has no power, so all the damage is the indirect 3.

const BOMBER = Cards.units.jtl.tieBomber;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, BOMBER)
    .WithActivePlayer(1);
}

describe("JTL_237 TIE Bomber", () => {
  it("with no enemy units, all 3 indirect damage goes to the defending base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player2.base.damage).toBe(3); // 0 combat + 3 indirect
  });

  it("control: an attacker without the ability deals only its combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.grandMoffTarkin)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.ibh.scoutingTieFighter)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2); // just its 2 combat damage
  });

  it("the defender may split it between units and base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    const walkerId = g.state.player2.groundArena[0].playId;
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [
        { playId: walkerId, damage: 2 },
        { playId: "player2.base", damage: 1 },
      ],
    });

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("rejects an assignment that does not total exactly 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, Cards.units.sor.reinforcementWalker).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.dispatchAsync(2, "choose-target", {
      spreadDamageAssignments: [{ playId: "player2.base", damage: 2 }],
    });

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });
});
