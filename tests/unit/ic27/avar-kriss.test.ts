import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_071 Avar Kriss — For Light and Life (0/5 Ground, cost 2, Command/Heroism)
//   "Raid 1. This unit gains Raid 1 for each other friendly unit."

const AVAR = Cards.units.ic27.avarKriss;
const MARINE = Cards.units.sor.battlefieldMarine;
const XWING = Cards.units.sor.allianceXWing;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, AVAR);
}

async function attackBase(g: GameTestAdapter) {
  await g.attackWithGroundUnitAsync(1, 0);
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_071 Avar Kriss — For Light and Life", () => {
  it("alone she attacks with her printed Raid 1 only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await attackBase(g);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("gains Raid 1 for each other friendly unit, in either arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, XWING).Build());

    await attackBase(g);

    expect(g.state.player2.base.damage).toBe(3); // 1 printed + 2 others
  });

  it("enemy units don't count", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).WithSpaceUnitForPlayer(2, XWING).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("Raid only applies while attacking — her power is 0 otherwise", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());
    const { Unit } = await import("@/server/engine/unit");

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(0);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower(true)).toBe(2);
  });
});
