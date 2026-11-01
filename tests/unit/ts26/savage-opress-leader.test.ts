import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// TS26_05 Savage Opress — You Must Have Your Revenge (Leader, Aggression/Villainy, Force/Underworld)
//   Front (leader zone): "Each friendly unit with the most power among friendly units gains
//     Overwhelm." Ties: every tied unit has the most power, so each gains it.
//   Epic Action: deploy with 6 or more resources.
//   Deployed (3/7): "Raid 3. Overwhelm. Each other friendly unit gains Overwhelm." — TWI_009
//     Maul's deployed side plus Raid 3.
// No Action ability on either side.

const SAVAGE = Cards.leaders.ts26.savageOpress;
const MARINE = Cards.units.sor.battlefieldMarine;        // 3/3
const CONSULAR = Cards.units.sor.consularSecurityForce;  // 3/7
const DIANOGA = Cards.units.hmw.filthyDianoga;           // 5/5
const DROID = Cards.units.token.battleDroid;             // 1/1

function board(leader: string, deployed = false) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(leader, true, deployed)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const overwhelm = (g: GameTestAdapter, player: 1 | 2, idx: number) => {
  const u = (player === 1 ? g.state.player1 : g.state.player2).groundArena[idx];
  return HasOverwhelm(u.cardId, u.playId, player) === true;
};

describe("TS26_05 Savage Opress — leader side", () => {
  it("the friendly unit with the most power gains Overwhelm; a weaker one does not", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(SAVAGE).WithGroundUnitForPlayer(1, DIANOGA).WithGroundUnitForPlayer(1, MARINE).Build());
    expect(overwhelm(g, 1, 0)).toBe(true);
    expect(overwhelm(g, 1, 1)).toBe(false);
  });

  it("tied for most power: each tied unit gains Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(SAVAGE).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, CONSULAR).Build());
    expect(overwhelm(g, 1, 0)).toBe(true);
    expect(overwhelm(g, 1, 1)).toBe(true);
  });

  it("enemy units don't count and don't gain it", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(SAVAGE).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, DIANOGA).Build());
    expect(overwhelm(g, 1, 0)).toBe(true);  // most powerful FRIENDLY unit
    expect(overwhelm(g, 2, 0)).toBe(false);
  });

  it("control: under another leader the strongest unit has no Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.leaders.sor.sabineWren).WithGroundUnitForPlayer(1, DIANOGA).Build());
    expect(overwhelm(g, 1, 0)).toBe(false);
  });

  it("in combat: the strongest unit's excess damage spills onto the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board(SAVAGE)
        .WithGroundUnitForPlayer(1, DIANOGA)
        .WithGroundUnitForPlayer(2, DROID)
        .Build(),
    );
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.base.damage).toBe(4); // 5 power − 1 HP
  });
});

describe("TS26_05 Savage Opress — deployed", () => {
  function deployed() {
    return board(SAVAGE, true).WithGroundUnitForPlayer(1, SAVAGE);
  }

  it("has Raid 3 and Overwhelm himself", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());
    const s = g.state.player1.groundArena[0];
    expect(RaidAmount(s.cardId, s.playId, 1)).toBe(3);
    expect(overwhelm(g, 1, 0)).toBe(true);
  });

  it("attacking a base deals 3 + 3", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().Build());
    await g.attackWithGroundUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("each other friendly unit gains Overwhelm — not only the strongest", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(1, DIANOGA).WithGroundUnitForPlayer(1, MARINE).Build());
    expect(overwhelm(g, 1, 1)).toBe(true);
    expect(overwhelm(g, 1, 2)).toBe(true);
  });

  it("enemy units do not gain Overwhelm", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployed().WithGroundUnitForPlayer(2, MARINE).Build());
    expect(overwhelm(g, 2, 0)).toBe(false);
  });
});
