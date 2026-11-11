import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// "Epic Action: If you control N or more resources, deploy this leader." The resources are a
// condition, not a cost: deploying exhausts none of them.

const CASES: Array<[string, string, number]> = [
  ["IC27_002 Rey", Cards.leaders.ic27.rey, 5],
  ["IC27_003 Kylo Ren", Cards.leaders.ic27.kyloRen, 5],
  ["IC27_004 Mace Windu", Cards.leaders.ic27.maceWindu, 6],
  ["IC27_005 Darth Maul", Cards.leaders.ic27.darthMaul, 5],
  ["IC27_006 Luke Skywalker", Cards.leaders.ic27.lukeSkywalker, 6],
];

function board(leader: string, resources: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resources);
}

describe.each(CASES)("%s — Epic Action deploy threshold", (_name, leader, threshold) => {
  it(`cannot deploy with ${threshold - 1} resources`, async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(leader, threshold - 1).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(false);
  });

  it(`deploys with exactly ${threshold} resources, exhausting none`, async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(leader, threshold).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === leader)).toBe(true);
    // Only the resources that paid nothing are checked: Mace Windu's When Deployed adds one more,
    // exhausted, from the top of the deck.
    expect(g.state.player1.resources.slice(0, threshold).filter(r => !r.ready)).toHaveLength(0);
  });
});
