import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_099 Blizzard One (5/7 Ground, cost 7, Imperial Vehicle Walker)
// "When Played: You may defeat a non-leader ground unit with 3 or less remaining HP."

function setup(enemyGround?: string, enemySpace?: string) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.ibh.blizzardOne);
  if (enemyGround) b = b.WithGroundUnitForPlayer(2, enemyGround);
  if (enemySpace) b = b.WithSpaceUnitForPlayer(2, enemySpace);
  return b;
}

describe("IBH_099 Blizzard One — When Played: may defeat a non-leader ground unit (≤3 HP)", () => {
  it("defeats a chosen ≤3-HP ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.sor.battlefieldMarine).Build()); // 3/3

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Yes");
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("declining leaves the unit in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);
    const after = await g.chooseOptionAsync(1, "No");

    expect(after.lastDispatchResponse).toBeDefined();
    expect(g.state.player2.groundArena).toHaveLength(1);
  });

  it("control: a >3-HP ground unit and a ≤3-HP space unit are both ineligible → no prompt", async () => {
    const g = new GameTestAdapter();
    // Gamorrean Guards (4 HP, ground) too healthy; System Patrol Craft (≤3? 4 HP space) — use a 3-HP space unit.
    g.loadNewState(setup(Cards.units.sor.gamorreanGuards, Cards.units.ibh.rebellionYWing).Build());

    const after = await g.playCardFromHandAsync(1, 0);

    expect(after.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena).toHaveLength(1);
    expect(g.state.player2.spaceArena).toHaveLength(1);
  });
});
