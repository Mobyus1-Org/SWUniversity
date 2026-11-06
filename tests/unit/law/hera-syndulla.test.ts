import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost, pilotPlayCost } from "@/server/engine/card-playability";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// LAW_009 Hera Syndulla — Not Fighting Alone (Leader, Command/Heroism; unit side 3/6 Ground)
//   Front: "While you control 2 or more units, ignore the aspect penalties on Heroism units you play.
//           Epic Action: If you control 5 or more resources, deploy this leader."
//   Unit:  "Restore 1. While you control 2 or more units, ignore the aspect penalties on Heroism
//           units you play."
// Only units: not events, upgrades, or a unit played as a Pilot upgrade.

const HERA = Cards.leaders.law.heraSyndulla;
const CONSULAR = Cards.units.sor.consularSecurityForce; // Vigilance/Heroism, cost 4
const MARINE = Cards.units.sor.battlefieldMarine;
const PAIGE = Cards.units.jtl.paigeTico;                // Vigilance/Heroism, Piloting [2]
const FORCE_WITH_ME = Cards.events.sor.theForceIsWithMe; // Vigilance/Heroism event, cost 4

// Red base (Aggression) + Hera (Command/Heroism): a Vigilance icon is uncovered, so +2.
function board(units: number) {
  let b = new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(HERA)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 4);
  for (let i = 0; i < units; i++) b = b.WithGroundUnitForPlayer(1, MARINE);
  return b;
}

describe("LAW_009 Hera Syndulla — ignore aspect penalties on Heroism units", () => {
  it("with 2 units in play, a Heroism unit costs its printed cost", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2).Build());

    expect(playCost(g.state, 1, CONSULAR)).toBe(4);
  });

  it("with only 1 unit, the penalty applies", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).Build());

    expect(playCost(g.state, 1, CONSULAR)).toBe(6);
  });

  it("the opponent's units don't count", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, MARINE).Build());

    expect(playCost(g.state, 1, CONSULAR)).toBe(6);
  });

  it("not events, not Pilot plays", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2).Build());

    expect(playCost(g.state, 1, FORCE_WITH_ME)).toBe(6);
    expect(pilotPlayCost(g.state, 1, PAIGE)).toBe(4);
    expect(playCost(g.state, 1, PAIGE)).toBe(2); // played as a unit, it is waived
  });

  it("end to end: plays the unit with exactly 4 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(2).WithCardInHandForPlayer(1, CONSULAR).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.groundArena.map(u => u.cardId)).toContain(CONSULAR);
  });

  it("deployed: Restore 1, and the waiver is still on (Hera counts as one of the units)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(1).FillResourcesForPlayer(1, MARINE, 6).Build());
    await g.deployLeaderAsync(1);
    const hera = g.state.player1.groundArena.find(u => u.cardId === HERA)!;

    expect(RestoreAmount(HERA, hera.playId, 1)).toBe(1);
    expect(playCost(g.state, 1, CONSULAR)).toBe(4);
  });
});
