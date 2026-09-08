import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_083 Seasoned Shoretrooper (2/3 Ground, cost 2, Imperial/Trooper) —
//   "While you control 6 or more resources, this unit gets +2/+0."
//
// A straight reprint of SOR_081, which the engine already handles — so this is a registration, not
// new logic. Worth its own test anyway: the SOR printing being wired says nothing about the SHD id,
// and nothing links the two.
//
// "Control 6 or more resources" counts exhausted ones too: the wording is about control.

const SHORETROOPER = "SHD_083";
const FILLER = Cards.units.sor.battlefieldMarine;

function board(resources: number, ready = true) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, FILLER, resources, ready)
    .WithGroundUnitForPlayer(1, SHORETROOPER)
    .WithActivePlayer(1);
}

const power = (g: GameTestAdapter) =>
  Unit.FromInterface(g.state.player1.groundArena.find(u => u.cardId === SHORETROOPER)!).CurrentPower();

describe("SHD_083 Seasoned Shoretrooper", () => {
  it("gets +2/+0 at 6 resources", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());
    expect(power(g)).toBe(4); // 2 + 2
  });

  it("is a plain 2/3 at 5 resources", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(5).Build());
    expect(power(g)).toBe(2);
  });

  it("counts EXHAUSTED resources — the text says control, not ready", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6, false).Build());
    expect(power(g)).toBe(4);
  });

  it("does not count the opponent's resources", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.directorKrennic)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, FILLER, 3)
        .FillResourcesForPlayer(2, FILLER, 9)
        .WithGroundUnitForPlayer(1, SHORETROOPER)
        .WithActivePlayer(1)
        .Build(),
    );
    expect(power(g)).toBe(2);
  });

  it("the bonus is real in combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4);
  });
});
