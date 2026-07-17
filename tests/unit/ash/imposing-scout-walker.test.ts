import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_176 Imposing Scout Walker (6/4 Ground, cost 6) —
// "When Played: You may deal 3 damage to a ground unit. If it's defeated this way, give 3
//  Advantage tokens to this unit."

function advantageCount(u: { upgrades: { cardId: string }[] }): number {
  return u.upgrades.filter(upg => upg.cardId === "ASH_T02").length;
}

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.ash.imposingScoutWalker);
}

describe("ASH_176 Imposing Scout Walker", () => {
  it("deals 3 damage and, when it defeats the target, gives 3 Advantage tokens to itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 — dies to 3 damage
        .Build(),
    );
    const targetPlayId = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const walkerPlayId = g.state.player1.groundArena[0].playId;
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.groundArena.some(u => u.playId === targetPlayId)).toBe(false);
    const walker = g.state.player1.groundArena.find(u => u.playId === walkerPlayId)!;
    expect(advantageCount(walker)).toBe(3);
  });

  it("deals 3 damage but gives no tokens when the target survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.steadfastBattalion) // 5/5 — survives 3 damage
        .Build(),
    );
    const targetPlayId = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const walkerPlayId = g.state.player1.groundArena[0].playId;
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(3);
    const walker = g.state.player1.groundArena.find(u => u.playId === walkerPlayId)!;
    expect(advantageCount(walker)).toBe(0);
  });

  it("declining deals no damage and gives no tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );
    const targetPlayId = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    const walkerPlayId = g.state.player1.groundArena[0].playId;
    await g.chooseNoAsync(1);

    const target = g.state.player2.groundArena.find(u => u.playId === targetPlayId)!;
    expect(target.damage).toBe(0);
    const walker = g.state.player1.groundArena.find(u => u.playId === walkerPlayId)!;
    expect(advantageCount(walker)).toBe(0);
  });
});
