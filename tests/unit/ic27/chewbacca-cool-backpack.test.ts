import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// IC27_162 Chewbacca — Cool Backpack (4/6 Ground, cost 6, Cunning/Heroism)
//   "Sentinel. While this unit is damaged, he gets +4/+0."

const CHEWIE = Cards.units.ic27.chewbacca;

function board(damage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, CHEWIE, true, damage);
}

const chewie = (g: GameTestAdapter) => Unit.FromInterface(g.state.player1.groundArena[0]);

describe("IC27_162 Chewbacca", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).Build());
    expect(HasSentinel(CHEWIE, chewie(g).playId, 1)).toBe(true);
  });

  it("undamaged he is 4/6", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(0).Build());
    expect(chewie(g).CurrentPower()).toBe(4);
  });

  it("damaged he gets +4/+0 — power only", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).Build());
    expect(chewie(g).CurrentPower()).toBe(8);
    expect(chewie(g).TotalHP()).toBe(6);
  });

  it("attacks for 8 while damaged", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(8);
  });

  it("a blanked Chewbacca gets no bonus", () => {
    const g = new GameTestAdapter();
    const state = board(1).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning, duration: "Phase", affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);
    expect(chewie(g).CurrentPower()).toBe(4);
  });
});
