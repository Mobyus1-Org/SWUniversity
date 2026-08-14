import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";
import { Cards } from "../../card-helpers";

// JTL_093 Nien Nunb — Loyal Co-Pilot (1/2 Ground Rebel Pilot) —
//   "This unit gets +1/+0 for each other friendly Pilot unit and upgrade."
//   "Piloting [1 resource]"
//   "Attached unit gets +1/+0 for each other friendly Pilot unit and upgrade."
//
// Both halves count the SAME thing: other friendly Pilot units plus friendly Pilot upgrades.
function pilotUpgrade(cardId: string, owner: 1 | 2) {
  return { cardId, playId: "@", owner, controller: owner };
}

function powerOf(g: GameTestAdapter, player: 1 | 2, index: number, arena: "ground" | "space" = "ground") {
  const list = arena === "ground"
    ? (player === 1 ? g.state.player1.groundArena : g.state.player2.groundArena)
    : (player === 1 ? g.state.player1.spaceArena : g.state.player2.spaceArena);
  return Unit.FromInterface(list[index]).CurrentPower();
}

describe("JTL_093 Nien Nunb — unit side", () => {
  it("has just its printed power with no other Pilots around", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.nienNunb)
        .Build(),
    );
    expect(powerOf(g, 1, 0)).toBe(1);
  });

  it("gets +1 for each other friendly Pilot unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.nienNunb)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.frisk)
        .Build(),
    );
    expect(powerOf(g, 1, 0)).toBe(2);
  });

  it("gets +1 for each friendly Pilot upgrade too", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.nienNunb)
        .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [pilotUpgrade(Cards.units.jtl.frisk, 1)])
        .Build(),
    );
    expect(powerOf(g, 1, 0)).toBe(2);
  });

  // "friendly" — an enemy Pilot must not feed the count.
  it("does not count enemy Pilots", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.nienNunb)
        .WithGroundUnitForPlayer(2, Cards.units.jtl.frisk)
        .Build(),
    );
    expect(powerOf(g, 1, 0)).toBe(1);
  });

  // "each OTHER" — Nien Nunb is a Pilot himself and must not count himself.
  it("does not count itself", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.nienNunb)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.nienNunb)
        .Build(),
    );
    // Each sees exactly one OTHER Pilot unit.
    expect(powerOf(g, 1, 0)).toBe(2);
  });
});

describe("JTL_093 Nien Nunb — attached as a Pilot upgrade", () => {
  it("gives its host +1 for each other friendly Pilot unit and upgrade", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        // 10/10 vehicle carrying Nien Nunb as its pilot.
        .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [pilotUpgrade(Cards.units.jtl.nienNunb, 1)])
        // One other friendly Pilot unit on the board.
        .WithGroundUnitForPlayer(1, Cards.units.jtl.frisk)
        .Build(),
    );
    // 10 printed + 1 from Nien Nunb's own upgrade power + 1 for the other Pilot (Frisk).
    // Nien Nunb himself is the attached upgrade, so he is not an "other".
    expect(powerOf(g, 1, 0, "space")).toBe(12);
  });

  it("gives its host no bonus when it is the only Pilot", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [pilotUpgrade(Cards.units.jtl.nienNunb, 1)])
        .Build(),
    );
    expect(powerOf(g, 1, 0, "space")).toBe(11); // 10 printed + 1 upgrade power
  });
});
