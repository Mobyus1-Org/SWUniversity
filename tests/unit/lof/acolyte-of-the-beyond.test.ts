import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_129 Acolyte of the Beyond (2/3 Ground, Sith, cost 2)
//   "On Attack/When Defeated: The Force is with you (create your Force token)."
//
// The Force token is binary — you either control it or you don't — so creating it while you
// already have it is a no-op rather than a second token.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const force = (g: GameTestAdapter, p: 1 | 2 = 1) =>
  (p === 1 ? g.state.player1 : g.state.player2).supplemental.forceToken === true;

describe("LOF_129 Acolyte of the Beyond — On Attack", () => {
  it("creates your Force token when it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.acolyteOfTheBeyond).Build());
    expect(force(g)).toBe(false);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(force(g)).toBe(true);
    expect(force(g, 2)).toBe(false); // only its controller's token
  });

  it("control: an unrelated unit attacking creates nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(force(g)).toBe(false);
  });
});

describe("LOF_129 Acolyte of the Beyond — When Defeated", () => {
  it("creates your Force token when it is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.acolyteOfTheBeyond)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3 power kills a 2/3
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(force(g)).toBe(true); // the Acolyte's OWNER gets it, not the attacker
    expect(force(g, 2)).toBe(false);
  });

  it("already controlling the Force token leaves it at one", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup().WithGroundUnitForPlayer(1, Cards.units.lof.acolyteOfTheBeyond).Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(force(g)).toBe(true);
  });
});
