import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { playCost } from "@/server/engine/card-playability";
import { Cards } from "../../card-helpers";

// LOF_056 Size Matters Not — Upgrade (Force, cost 3)
// "If you control a Force unit, this upgrade costs 1 resource less to play."
// "Attached unit's printed power is considered to be 5 and its printed HP is considered to be 5."

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren);
}

function smn() {
  return GameStateBuilder.Upgrade(Cards.upgrades.lof.sizeMattersNot, 1);
}

describe("LOF_056 Size Matters Not — stat override", () => {
  it("raises a small unit's printed power and HP to 5/5", () => {
    const s = base().WithGroundUnitForPlayer(1, Cards.units.lof.gungi).Build(); // Gungi is 2/5
    s.player1.groundArena[0].upgrades = [smn()];
    const g = new GameTestAdapter(); g.loadNewState(s);
    const gungi = Unit.FromInterface(g.state.player1.groundArena[0]);

    expect(gungi.CurrentPower()).toBe(5); // printed 2 → 5
    expect(gungi.TotalHP()).toBe(5);      // printed 5 → 5
  });

  it("lowers a big unit's printed power and HP to 5/5", () => {
    const s = base().WithGroundUnitForPlayer(1, Cards.units.sor.lukeSkywalker).Build(); // Luke is 6/7
    s.player1.groundArena[0].upgrades = [smn()];
    const g = new GameTestAdapter(); g.loadNewState(s);
    const luke = Unit.FromInterface(g.state.player1.groundArena[0]);

    expect(luke.CurrentPower()).toBe(5); // printed 6 → 5
    expect(luke.TotalHP()).toBe(5);      // printed 7 → 5
  });

  it("other modifiers still stack on top of the 5/5 base", () => {
    const s = base().WithGroundUnitForPlayer(1, Cards.units.lof.gungi).Build();
    // Size Matters Not + an Experience token (+1/+1).
    s.player1.groundArena[0].upgrades = [smn(), GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 1)];
    const g = new GameTestAdapter(); g.loadNewState(s);
    const gungi = Unit.FromInterface(g.state.player1.groundArena[0]);

    expect(gungi.CurrentPower()).toBe(6); // 5 (printed override) + 1 (XP)
    expect(gungi.TotalHP()).toBe(6);      // 5 + 1
  });
});

describe("LOF_056 Size Matters Not — cost reduction", () => {
  it("costs 1 less to play while you control a Force unit", () => {
    const withForce = base().WithGroundUnitForPlayer(1, Cards.units.lof.gungi).Build();       // Gungi is Force
    const withoutForce = base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build(); // not Force

    const costWith = playCost(withForce, 1, Cards.upgrades.lof.sizeMattersNot);
    const costWithout = playCost(withoutForce, 1, Cards.upgrades.lof.sizeMattersNot);

    // The two states differ only by whether the controlled unit is a Force unit, so the delta is
    // exactly the 1-resource discount (aspect penalty, if any, is identical in both).
    expect(costWithout - costWith).toBe(1);
  });
});
