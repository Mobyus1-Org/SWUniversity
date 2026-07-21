import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_016 Ion Cannon (0-power / 5 HP Ground, cost 4, Weapon, Cunning)
// "Action [Exhaust]: Deal 3 damage to a space unit."

function setup(ionId = Cards.units.ibh.ionCannon) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithGroundUnitForPlayer(1, ionId)
    .WithSpaceUnitForPlayer(2, Cards.units.sor.systemPatrolCraft); // 3/4 space
}

describe("IBH_016 Ion Cannon — Action: Deal 3 damage to a space unit", () => {
  it("exhausts and deals 3 to the chosen space unit", async () => {
    const g = new GameTestAdapter();
    const s = setup().Build();
    g.loadNewState(s);
    const ionPlayId = s.player1.groundArena[0].playId;
    const targetPlayId = s.player2.spaceArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.ionCannon, playId: ionPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player1.groundArena[0].ready).toBe(false); // exhausted
    expect(g.state.player2.spaceArena[0].damage).toBe(3);
  });

  it("can defeat a 3-HP space unit", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.ibh.ionCannon)
      .WithSpaceUnitForPlayer(2, Cards.units.ibh.rebellionYWing) // 2/3 space
      .Build();
    g.loadNewState(s);
    const ionPlayId = s.player1.groundArena[0].playId;
    const targetPlayId = s.player2.spaceArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.ionCannon, playId: ionPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.spaceArena).toHaveLength(0); // 3 damage on 3 HP → defeated
  });

  it("alt printing IBH_027 also deals 3 to a space unit", async () => {
    const g = new GameTestAdapter();
    const s = setup(Cards.units.ibh.ionCannonB).Build();
    g.loadNewState(s);
    const ionPlayId = s.player1.groundArena[0].playId;
    const targetPlayId = s.player2.spaceArena[0].playId;

    await g.dispatchAsync(1, "use-ability", { cardId: Cards.units.ibh.ionCannonB, playId: ionPlayId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(3);
  });
});
