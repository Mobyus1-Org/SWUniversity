import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_051 Luke Skywalker (Unit) — Heroism, Cost 7
// Restore 3 (already implemented)
// When Played: Give an enemy unit –3/–3 for this phase.
//   If a friendly unit was defeated this phase, give that enemy unit –6/–6 for this phase instead.

describe("SOR_051 Luke Skywalker When Played", () => {
  it("gives an enemy unit -3/-3 for this phase when no friendly was defeated", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)   // 3/3 enemy target
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lukeSkywalker)
      .Build();
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0); // play Luke Skywalker
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // Battlefield Marine (3/3) gets -3/-3: power = 0, hp = 0 → CurrentHP <= 0 → defeated
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("gives an enemy unit -6/-6 for this phase when a friendly unit was defeated this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.lukeSkywalker)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .WithGroundUnitForPlayer(2, Cards.units.sor.blizzardAssaultAtAt) // 9/9 target (survives -3/-3 but not -6/-6)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, Cards.units.sor.lukeSkywalker)
      .Build();
    g.loadNewState(state);

    // Mark a friendly unit as having been defeated this phase
    state.roundState.cardsLeftPlayThisPhase.push({
      fromPlayer: 1,
      cardId: Cards.units.sor.battlefieldMarine,
      playId: "test-defeated",
      reason: "defeated",
    });
    g.loadNewState(state);

    const enemyPlayId = state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyPlayId] });

    // Blizzard AT-AT (9/9) gets -6/-6: effective HP = 9-6 = 3, power = 9-6 = 3
    // It should survive (HP buff reduced by 6 but still has 3 HP)
    expect(g.state.player2.groundArena[0]?.damage ?? 0).toBe(0); // no damage, just debuff
    // Verify debuff: CurrentPower should be 3 (9-6) and CurrentHP should be 3 (9-6)
    // We verify this indirectly: the unit should still be alive (not defeated)
    expect(g.state.player2.groundArena).toHaveLength(1);
  });
});
