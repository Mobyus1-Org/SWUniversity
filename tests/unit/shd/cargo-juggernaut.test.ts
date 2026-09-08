import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";

// SHD_066 Cargo Juggernaut (4/6 Ground, cost 6, Vigilance, Vehicle/Tank) —
//   "Shielded"
//   "When Played: If you control another Vigilance unit, heal 4 damage from your base."
//
// The heal is an AUTOMATIC When Played effect on a UNIT, which means it belongs in
// resolveWhenPlayedTrigger and not resolveWhenPlayed — the latter runs twice for units (a preview
// pass and the real drain), so a side effect placed there heals 8 instead of 4.
//
// "Another Vigilance unit" excludes the Juggernaut itself, which is Vigilance.
//
// It carries TWO simultaneous When-Played-time triggers (Shielded and the heal), so the engine
// asks which to resolve first. Every test here answers that prompt — a fixture that ignores it
// looks exactly like neither ability firing.

const JUGGERNAUT = "SHD_066";
const SHIELD = Cards.upgrades.token.shield;
const VIGILANCE_UNIT = "SHD_063";                  // System Patrol Craft — Vigilance
const NON_VIGILANCE = Cards.units.sor.battlefieldMarine;

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 10)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, NON_VIGILANCE, 14)
    .WithCardInHandForPlayer(1, JUGGERNAUT)
    .WithActivePlayer(1);
}

const juggernaut = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === JUGGERNAUT)!;

describe("SHD_066 Cargo Juggernaut", () => {
  it("has Shielded", () => {
    expect(HasShielded(JUGGERNAUT)).toBe(true);
  });

  it("enters play with a Shield token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Cargo Juggernaut — Shielded");

    expect(juggernaut(g).upgrades.map(u => u.cardId)).toEqual([SHIELD]);
  });

  it("heals exactly 4 with another Vigilance unit out", async () => {
    // Exactly 4 is the assertion that matters: the double-resolution trap heals 8.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(1, VIGILANCE_UNIT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Cargo Juggernaut — When Played");

    expect(g.state.player1.base.damage).toBe(6); // 10 - 4
  });

  it("heals nothing without another Vigilance unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, NON_VIGILANCE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Cargo Juggernaut — When Played");

    expect(g.state.player1.base.damage).toBe(10);
  });

  it("does not count ITSELF, though it is Vigilance", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Cargo Juggernaut — When Played");

    expect(g.state.player1.base.damage).toBe(10);
  });

  it("an ENEMY Vigilance unit does not count — 'you control'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithSpaceUnitForPlayer(2, VIGILANCE_UNIT).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Cargo Juggernaut — When Played");

    expect(g.state.player1.base.damage).toBe(10);
  });

  it("never heals past zero", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP, 2)
        .MyLeader(Cards.leaders.sor.directorKrennic)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, NON_VIGILANCE, 14)
        .WithSpaceUnitForPlayer(1, VIGILANCE_UNIT)
        .WithCardInHandForPlayer(1, JUGGERNAUT)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Cargo Juggernaut — When Played");

    expect(g.state.player1.base.damage).toBe(0);
  });
});
