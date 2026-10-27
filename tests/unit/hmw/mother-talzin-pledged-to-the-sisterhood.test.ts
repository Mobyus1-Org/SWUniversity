import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// HMW_039 Mother Talzin — Pledged to the Sisterhood (3/4 Ground, cost 3, Vigilance/Aggression,
// Force Night, unique)
//   Raid 1
//   Each other friendly unit gains Restore 1.
//
// Every attack goes at the enemy base; P1's own base starts at 5 damage so each Restore heal shows.
const TALZIN = Cards.units.hmw.motherTalzinPledged;
const VANILLA_GROUND = Cards.units.hmw.ewokBrigade;          // 2/4, no text
const VANILLA_SPACE = Cards.units.ibh.scoutingTieFighter;    // 2/2 Space, no text
const RESTORE_2 = Cards.units.ash.remnantOfficial;           // 3/3, Restore 2 and nothing else

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10)
    .WithActivePlayer(1);
}

const attackBase = async (g: GameTestAdapter, attackerPlayId: string) => {
  await g.dispatchAsync(1, "initiate-attack", { playId: attackerPlayId });
  // Only the enemy base is attackable in these setups; pick it if the engine asks.
  if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
};
const playIdOf = (g: GameTestAdapter, cardId: string) =>
  [...g.state.player1.groundArena, ...g.state.player1.spaceArena].find(u => u.cardId === cardId)!.playId;

describe("HMW_039 Mother Talzin — Raid 1", () => {
  it("attacks the base for 4 (3 power + Raid 1), and has no Restore herself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, TALZIN).Build());
    expect(RaidAmount(TALZIN, playIdOf(g, TALZIN), 1)).toBe(1);

    await attackBase(g, playIdOf(g, TALZIN));
    expect(g.state.player2.base.damage).toBe(4);
    expect(g.state.player1.base.damage).toBe(5); // "each OTHER friendly unit" — not her
  });
});

describe("HMW_039 Mother Talzin — each other friendly unit gains Restore 1", () => {
  it("control: a vanilla unit attacking without Talzin heals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, VANILLA_GROUND).Build());
    await attackBase(g, playIdOf(g, VANILLA_GROUND));
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("a friendly ground unit attacking heals 1 from your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, TALZIN).WithGroundUnitForPlayer(1, VANILLA_GROUND).Build());
    await attackBase(g, playIdOf(g, VANILLA_GROUND));
    expect(g.state.player2.base.damage).toBe(2);
    expect(g.state.player1.base.damage).toBe(4);
  });

  it("a friendly space unit gains it too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, TALZIN).WithSpaceUnitForPlayer(1, VANILLA_SPACE).Build());
    await attackBase(g, playIdOf(g, VANILLA_SPACE));
    expect(g.state.player1.base.damage).toBe(4);
  });

  it("stacks with a printed Restore (Restore 2 + Restore 1 heals 3)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, TALZIN).WithGroundUnitForPlayer(1, RESTORE_2).Build());
    expect(RestoreAmount(RESTORE_2, playIdOf(g, RESTORE_2), 1)).toBe(3);
    await attackBase(g, playIdOf(g, RESTORE_2));
    expect(g.state.player1.base.damage).toBe(2);
  });

  it("enemy units do not gain Restore", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, TALZIN).WithGroundUnitForPlayer(2, VANILLA_GROUND).Build());
    const enemy = g.state.player2.groundArena[0];
    expect(RestoreAmount(enemy.cardId, enemy.playId, 2)).toBe(0);
  });

  it("the aura switches off while Talzin has lost her abilities", async () => {
    const g = new GameTestAdapter();
    const state = base().WithGroundUnitForPlayer(1, TALZIN).WithGroundUnitForPlayer(1, VANILLA_GROUND).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);
    await attackBase(g, playIdOf(g, VANILLA_GROUND));
    expect(g.state.player1.base.damage).toBe(5);
  });
});
