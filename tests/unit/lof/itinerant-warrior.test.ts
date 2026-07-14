import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_048 Itinerant Warrior (4/4 Ground, Force/Jedi, cost 4)
// "Shielded (When you play this unit, give a Shield token to it.)"
// "When Played: You may use the Force (lose your Force token). If you do, heal 3 damage from a base."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 5) // 5 damage to heal from
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, 5)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, Cards.units.lof.itinerantWarrior);
}

function shieldCount(unit: { upgrades: { cardId: string }[] }): number {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
}

describe("LOF_048 Itinerant Warrior", () => {
  it("has Shielded: enters play with a Shield token", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    g.loadNewState(s); // no Force token → the When Played can't fire

    await g.playCardFromHandAsync(1, 0);

    const warrior = g.state.player1.groundArena.find(
      u => u.cardId === Cards.units.lof.itinerantWarrior,
    )!;
    expect(shieldCount(warrior)).toBe(1);
  });

  it("When Played: uses the Force to heal 3 damage from your own base", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 1); // heal your own base

    expect(g.state.player1.supplemental.forceToken).toBe(false); // the Force was used
    expect(g.state.player1.base.damage).toBe(2); // 5 - 3
    expect(g.state.player2.base.damage).toBe(5); // untouched
  });

  it("can heal the OPPONENT's base ('a base' — either one)", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2); // 5 - 3
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("declining keeps the Force token and heals nothing", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    const played = await g.playCardFromHandAsync(1, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.supplemental.forceToken).toBe(true); // kept
    expect(g.state.player1.base.damage).toBe(5); // no heal
  });

  it("no prompt at all without a Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build()); // no Force token

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.base.damage).toBe(5);
    expect(g.state.player1.groundArena).toHaveLength(1); // still entered play
  });
});
