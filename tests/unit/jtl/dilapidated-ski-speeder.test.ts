import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_248 Dilapidated Ski Speeder (3/7 Ground, cost 3, Resistance Vehicle Speeder)
// "When Played: Deal 3 damage to this unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("JTL_248 Dilapidated Ski Speeder — When Played", () => {
  it("deals 3 damage to itself when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithCardInHandForPlayer(1, Cards.units.jtl.dilapidatedSkiSpeeder).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // 7 HP unit sits at 3 damage (4 remaining) — it survives.
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(g.state.player1.groundArena[0].cardId).toBe(Cards.units.jtl.dilapidatedSkiSpeeder);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("control: a plain unit played the same way takes no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup().WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine).Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });
});
