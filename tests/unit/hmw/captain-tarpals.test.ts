import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Captain Tarpals (HMW_254) — 0/2, Raid 2. Power modifiers are summed before the 0 floor
// (CR: add, then subtract, then multiply), so a –1 Weakness token is offset by Raid while he
// attacks: 0 + 2 – 1 = 1, not max(0, 0 – 1) + 2 = 2 or a floored 0.
describe("Captain Tarpals", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.hmw.captainTarpals);
  }

  it("Raid 2 alone deals 2 to a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
  });

  it("with a Weakness token, Raid 2 deals 1 (0 + 2 – 1)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base()
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: Cards.units.token.weakness, playId: "w1", owner: 2, controller: 2 },
      ])
      .Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });
});
