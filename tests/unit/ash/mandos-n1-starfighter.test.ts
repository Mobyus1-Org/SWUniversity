import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_203 Mando's N-1 Starfighter (1/3 Space, cost 2)
// "Support (…)"
// "On Attack: You may exhaust a friendly (non-upgrade) leader. If you do, this unit gets +2/+0 for
//  this attack."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("ASH_203 Mando's N-1 Starfighter", () => {
  it("On Attack: exhausting your leader gives it +2/+0 for the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.ash.mandosN1Starfighter).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(3);       // 1 power + 2
    expect(g.state.player1.leader.ready).toBe(false);  // the cost was paid
  });

  it("declining leaves the leader ready and the power alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.ash.mandosN1Starfighter).Build());

    const targeted = await g.attackWithSpaceUnitAsync(1, 0).then(() => g.chooseBaseAsync(1, 2));
    expect(targeted.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("the +2/+0 does not linger past the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.ash.mandosN1Starfighter).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);

    const n1 = g.state.player1.spaceArena[0];
    expect(g.state.currentEffects.filter(e => e.targetPlayId === n1.playId)).toHaveLength(0);
  });

  it("no prompt when the leader is already exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .MyLeader(Cards.leaders.sor.sabineWren, false) // exhausted
        .WithSpaceUnitForPlayer(1, Cards.units.ash.mandosN1Starfighter)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    const res = await g.chooseBaseAsync(1, 2);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(1);
  });
});
