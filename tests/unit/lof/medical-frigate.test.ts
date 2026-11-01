import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_250 Medical Frigate (3/6 Space, cost 4, Heroism) —
//   "On Attack: You may heal 2 damage from another unit."
// Same text as SOR_059 2-1B Surgical Droid. Any arena, either side; never itself.

const FRIGATE = Cards.units.lof.medicalFrigate;
const MARINE = Cards.units.sor.battlefieldMarine;

function board(frigateDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithSpaceUnitForPlayer(1, FRIGATE, true, frigateDamage)
    .WithGroundUnitForPlayer(1, MARINE, true, 2) // damaged ground marine
    .WithActivePlayer(1);
}

const attackBase = async (g: GameTestAdapter) => {
  await g.attackWithSpaceUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
};

describe("LOF_250 Medical Frigate", () => {
  it("On Attack: may heal 2 from another unit (a ground unit, from space)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    const marineId = g.state.player1.groundArena[0].playId;

    await attackBase(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marineId] });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("may decline", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await attackBase(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[0].damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("cannot heal itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(3).Build());
    const frigateId = g.state.player1.spaceArena[0].playId;

    await attackBase(g);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toEqual([g.state.player1.groundArena[0].playId]);
    expect(res.fromPlayIds).not.toContain(frigateId);
  });
});
