import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// SEC_047 Coronet — Stately Vessel (4/6 Space, cost 5, Vigilance/Heroism, unique) —
//   Restore 1
//   "Each other friendly unit gains Restore 1."
// The aura is HMW_039 Mother Talzin's; Coronet's own keyword is Restore 1 (Talzin has Raid 1).
// P1's base starts at 5 damage so each heal shows.

const CORONET = Cards.units.sec.coronet;
const VANILLA = Cards.units.hmw.ewokBrigade;          // 2/4 Ground, no text
const RESTORE_2 = Cards.units.ash.remnantOfficial;    // 3/3 Ground, Restore 2 only

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 5)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1);
}

const attackBase = async (g: GameTestAdapter, playId: string) => {
  await g.dispatchAsync(1, "initiate-attack", { playId });
  if (g.lastDispatchResponse?.resolutionNeeded) await g.chooseBaseAsync(1, 2);
};

describe("SEC_047 Coronet — Restore 1", () => {
  it("attacking heals 1 from your base (its own Restore, not the aura's)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CORONET).Build());
    const c = g.state.player1.spaceArena[0];
    expect(RestoreAmount(c.cardId, c.playId, 1)).toBe(1);

    await attackBase(g, c.playId);
    expect(g.state.player1.base.damage).toBe(4);
    expect(g.state.player2.base.damage).toBe(4);
  });
});

describe("SEC_047 Coronet — each other friendly unit gains Restore 1", () => {
  it("control: a vanilla unit without Coronet heals nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, VANILLA).Build());
    await attackBase(g, g.state.player1.groundArena[0].playId);
    expect(g.state.player1.base.damage).toBe(5);
  });

  it("a friendly ground unit attacking heals 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CORONET).WithGroundUnitForPlayer(1, VANILLA).Build());
    await attackBase(g, g.state.player1.groundArena[0].playId);
    expect(g.state.player1.base.damage).toBe(4);
  });

  it("stacks with a printed Restore (Restore 2 + 1 heals 3)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CORONET).WithGroundUnitForPlayer(1, RESTORE_2).Build());
    const u = g.state.player1.groundArena[0];
    expect(RestoreAmount(u.cardId, u.playId, 1)).toBe(3);
    await attackBase(g, u.playId);
    expect(g.state.player1.base.damage).toBe(2);
  });

  it("enemy units do not gain Restore", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CORONET).WithGroundUnitForPlayer(2, VANILLA).Build());
    const enemy = g.state.player2.groundArena[0];
    expect(RestoreAmount(enemy.cardId, enemy.playId, 2)).toBe(0);
  });

  it("the aura switches off while Coronet has lost its abilities", async () => {
    const g = new GameTestAdapter();
    const state = board().WithSpaceUnitForPlayer(1, CORONET).WithGroundUnitForPlayer(1, VANILLA).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: state.player1.spaceArena[0].playId,
    });
    g.loadNewState(state);
    await attackBase(g, g.state.player1.groundArena[0].playId);
    expect(g.state.player1.base.damage).toBe(5);
  });
});
