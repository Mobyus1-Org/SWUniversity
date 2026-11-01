import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_054 Gold Leader — Fastest Ship in the Fleet (5/5 Space, cost 6, Vigilance/Heroism, unique) —
//   Shielded
//   "While this unit is defending, the attacker gets –1/–0."
// Only Shielded was registered; the defending clause (shared with LAW_108 Lando Calrissian) was
// missing until that reprint wired it.

const GOLD_LEADER = Cards.units.jtl.goldLeader;
const ATTACKER = Cards.units.hmw.coronaSquadronXWing; // 2/2 Space — On Attack only readies a resource

function board(defender: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.leiaOrgana)
    .WithSpaceUnitForPlayer(1, ATTACKER)
    .WithSpaceUnitForPlayer(2, defender)
    .WithActivePlayer(1);
}

describe("JTL_054 Gold Leader — attacker gets –1/–0 while it defends", () => {
  it("a 2-power attacker deals only 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(GOLD_LEADER).Build());
    const defenderId = g.state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(1);
  });

  it("control: the same attacker deals 2 to a unit without the clause", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.units.hmw.victorSquadron).Build()); // 5/5 Space, only "enters ready"
    const defenderId = g.state.player2.spaceArena[0].playId;

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });
});
