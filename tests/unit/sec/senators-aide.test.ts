import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import type { PlayerId } from "@/lib/engine/core-models";

// SEC_108 Senator's Aide (-/3 Ground, cost 1, Command, Republic/Official)
//   "While you have the initiative, this unit gets +2/+0."
// SHD_086 Warbird Stowaway prints the same aura (and SOR_161 Ardent Sympathizer).

function load(cardId: string, initiative: PlayerId) {
  const g = new GameTestAdapter();
  const state = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithGroundUnitForPlayer(1, cardId)
    .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives either way
    .Build();
  state.initiativePlayer = initiative;
  g.loadNewState(state);
  return g;
}

const power = (g: GameTestAdapter) => Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower();

describe("SEC_108 Senator's Aide", () => {
  it("has 2 power while its controller has the initiative", () => {
    expect(power(load(Cards.units.sec.senatorsAide, 1))).toBe(2);
  });

  it("has 0 power while the opponent has the initiative (control)", () => {
    expect(power(load(Cards.units.sec.senatorsAide, 2))).toBe(0);
  });

  it("deals 2 combat damage when attacking with the initiative", async () => {
    const g = load(Cards.units.sec.senatorsAide, 1);
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});

describe("SHD_086 Warbird Stowaway — same aura", () => {
  it("is 4/3 with the initiative, 2/3 without", () => {
    expect(power(load(Cards.units.shd.warbirdStowaway, 1))).toBe(4);
    expect(power(load(Cards.units.shd.warbirdStowaway, 2))).toBe(2);
  });
});
