import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// JTL_256 Swarming Vulture Droid (Unit 2/2 Space, cost 2, no aspects)
//   "A deck can have up to 15 copies of this card.
//    This unit gets +1/+0 for each other friendly Swarming Vulture Droid."
//
// The copy limit is a deckbuilding rule — nothing to do in a game.

const SVD = Cards.units.jtl.swarmingVultureDroid;

function powers(mine: number, theirs = 0) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
  for (let i = 0; i < mine; i++) b.WithSpaceUnitForPlayer(1, SVD);
  for (let i = 0; i < theirs; i++) b.WithSpaceUnitForPlayer(2, SVD);
  const g = new GameTestAdapter();
  g.loadNewState(b.Build());
  return g.state.player1.spaceArena.map(u => {
    const x = Unit.FromInterface(u);
    return { power: x.CurrentPower(), hp: x.TotalHP() };
  });
}

describe("JTL_256 Swarming Vulture Droid", () => {
  it("alone it is 2/2", () => {
    expect(powers(1)).toEqual([{ power: 2, hp: 2 }]);
  });

  it("+1/+0 for each OTHER friendly copy — three of them are each 4/2", () => {
    expect(powers(3)).toEqual(Array(3).fill({ power: 4, hp: 2 }));
  });

  it("enemy copies don't count", () => {
    expect(powers(1, 3)).toEqual([{ power: 2, hp: 2 }]);
  });
});
