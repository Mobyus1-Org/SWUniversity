import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SOR_012 IG-88 — Ruthless Bounty Hunter (Ground, Underworld/Droid/Bounty Hunter)
// Leader:   "Action [Exhaust]: Attack with a unit. If you control more units than the defending
//            player, the attacker gets +1/+0 for this attack."
// Deployed: "Each other friendly unit gains Raid 1."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.ig88)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("SOR_012 IG-88 — Leader ability", () => {
  it("attacks with a chosen unit, which gets +1/+0 when you control more units than the opponent", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        // Player 1 controls 2 units, player 2 controls 0 → more units than defender.
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power → 4 with buff
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // attack with the Marine
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4); // 3 printed + 1 from IG-88
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
  });

  it("does not grant +1/+0 when you do not control more units than the defending player", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power, unbuffed
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // opponent has 1 → counts equal
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // attack with the Marine
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // printed power only, no buff
  });
});
