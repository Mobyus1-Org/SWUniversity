import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// Two units whose whole ability is a conditional stat line, read at stat-calculation time.
//
//   TWI_058 Padawan Starfighter    — "While you control a Force unit or a Force upgrade, +1/+1."
//   TWI_163 Relentless Rocket Droid — "While you control another Trooper unit, +2/+0."

const PADAWAN = Cards.units.twi.padawanStarfighter;   // 1/3 Space
const ROCKET = Cards.units.twi.relentlessRocketDroid; // 3/5 Ground, Trooper
const FORCE_UNIT = Cards.units.sor.guardianOfTheWhills; // Force
const FORCE_UPGRADE = "ASH_227";                      // Heightened Awareness — carries the Force TRAIT
const PLAIN_UNIT = Cards.units.sor.consularSecurityForce; // Rebel/Trooper, no Force
const MARINE = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20);
}

const stats = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  const raw = [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId)!;
  const u = Unit.FromInterface(raw);
  return { power: u.CurrentPower(), hp: u.TotalHP() };
};

describe("TWI_058 Padawan Starfighter", () => {
  it("is 1/3 with no Force anywhere", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(1, PADAWAN).Build());
    expect(stats(g, 1, PADAWAN)).toEqual({ power: 1, hp: 3 });
  });

  it("gets +1/+1 while you control a Force UNIT", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithSpaceUnitForPlayer(1, PADAWAN).WithGroundUnitForPlayer(1, FORCE_UNIT).Build(),
    );
    expect(stats(g, 1, PADAWAN)).toEqual({ power: 2, hp: 4 });
  });

  it("gets +1/+1 from a Force UPGRADE too — the easy half to miss", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, PADAWAN)
        .WithGroundUnitForPlayer(1, PLAIN_UNIT)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(FORCE_UPGRADE, 1)])
        .Build(),
    );
    expect(stats(g, 1, PADAWAN)).toEqual({ power: 2, hp: 4 });
  });

  it("is not helped by an ENEMY Force unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithSpaceUnitForPlayer(1, PADAWAN).WithGroundUnitForPlayer(2, FORCE_UNIT).Build(),
    );
    expect(stats(g, 1, PADAWAN)).toEqual({ power: 1, hp: 3 });
  });
});

describe("TWI_163 Relentless Rocket Droid", () => {
  it("is 3/5 alone — it is a Trooper itself, but the clause says ANOTHER", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, ROCKET).Build());
    expect(stats(g, 1, ROCKET)).toEqual({ power: 3, hp: 5 });
  });

  it("gets +2/+0 while another friendly Trooper is in play", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, ROCKET).WithGroundUnitForPlayer(1, PLAIN_UNIT).Build(),
    );
    expect(stats(g, 1, ROCKET)).toEqual({ power: 5, hp: 5 }); // HP untouched
  });

  it("is not helped by an ENEMY Trooper", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, ROCKET).WithGroundUnitForPlayer(2, PLAIN_UNIT).Build(),
    );
    expect(stats(g, 1, ROCKET)).toEqual({ power: 3, hp: 5 });
  });

  it("is not helped by a friendly NON-Trooper", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base().WithGroundUnitForPlayer(1, ROCKET).WithGroundUnitForPlayer(1, Cards.units.sor.wampa).Build(),
    );
    expect(stats(g, 1, ROCKET)).toEqual({ power: 3, hp: 5 });
  });
});
