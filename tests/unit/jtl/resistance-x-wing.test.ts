import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// JTL_247 Resistance X-Wing (2/2 Space, cost 2, Resistance Vehicle Fighter)
// "While this unit has a Pilot on it, it gets +1/+1."

function xwing(g: GameTestAdapter) {
  return Unit.FromInterface(g.state.player1.spaceArena[0]);
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, Cards.units.jtl.resistanceXWing);
}

describe("JTL_247 Resistance X-Wing — +1/+1 while it has a Pilot", () => {
  it("is a plain 2/2 with nothing attached", () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    expect(xwing(g).CurrentPower()).toBe(2);
    expect(xwing(g).TotalHP()).toBe(2);
  });

  it("gets +1/+1 with a Pilot aboard (Luke +3/+2 upgrade → 2+3+1 / 2+2+1)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1), // a Pilot
        ])
        .Build(),
    );

    expect(xwing(g).CurrentPower()).toBe(6); // 2 base + 3 upgrade + 1 ability
    expect(xwing(g).TotalHP()).toBe(5); // 2 base + 2 upgrade + 1 ability
  });

  it("control: a non-Pilot upgrade grants no ability bonus", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1), // +1/+1, NOT a Pilot
        ])
        .Build(),
    );

    // Only the token's +1/+1 — the Pilot-gated ability does NOT fire.
    expect(xwing(g).CurrentPower()).toBe(3); // 2 base + 1 token, no ability bonus
    expect(xwing(g).TotalHP()).toBe(3);
  });
});
