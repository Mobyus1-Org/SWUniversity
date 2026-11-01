import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { playCost } from "@/server/engine/card-playability";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// TWI_254 Volunteer Soldier (2/3 Ground, cost 3, no aspect, Trooper) — reprint of SOR_248.
//   "Raid 1"
//   "If you control a Trooper unit, this unit costs 1 resource less to play."

const TROOPER = Cards.units.sor.battlefieldMarine;  // Rebel/Trooper, no text
const NON_TROOPER = Cards.units.hmw.filthyDianoga;  // Creature, no text

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1);
}

for (const [label, SOLDIER] of [
  ["TWI_254", Cards.units.twi.volunteerSoldier],
  ["SOR_248", Cards.units.sor.volunteerSoldier],
] as const) {
  describe(`${label} Volunteer Soldier — cost`, () => {
    it("costs 3 with no friendly Trooper (control)", () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithGroundUnitForPlayer(1, NON_TROOPER).Build());
      expect(playCost(g.state, 1, SOLDIER)).toBe(3);
    });

    it("costs 2 while you control a Trooper unit", () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithGroundUnitForPlayer(1, TROOPER).Build());
      expect(playCost(g.state, 1, SOLDIER)).toBe(2);
    });

    it("an ENEMY Trooper does not discount it", () => {
      const g = new GameTestAdapter();
      g.loadNewState(board().WithGroundUnitForPlayer(2, TROOPER).Build());
      expect(playCost(g.state, 1, SOLDIER)).toBe(3);
    });

    it("can be played with exactly 2 resources next to a Trooper", async () => {
      const g = new GameTestAdapter();
      g.loadNewState(
        board()
          .FillResourcesForPlayer(1, NON_TROOPER, 2)
          .WithGroundUnitForPlayer(1, TROOPER)
          .WithCardInHandForPlayer(1, SOLDIER)
          .Build(),
      );
      await g.playCardFromHandAsync(1, 0);
      expect(g.state.player1.groundArena.some(u => u.cardId === SOLDIER)).toBe(true);
      expect(g.state.player1.resources.filter(r => r.ready)).toHaveLength(0);
    });
  });
}

describe("TWI_254 Volunteer Soldier — Raid 1", () => {
  it("has Raid 1 and deals 3 to a base when attacking", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, Cards.units.twi.volunteerSoldier).Build());
    const u = g.state.player1.groundArena[0];
    expect(RaidAmount(u.cardId, u.playId, 1)).toBe(1);

    await g.attackWithGroundUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(3);
  });
});
