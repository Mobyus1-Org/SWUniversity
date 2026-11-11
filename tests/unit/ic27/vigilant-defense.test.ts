import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// IC27_046 Vigilant Defense (Event, cost 4, Vigilance/Vigilance)
//   "Give a friendly unit +0/+3 and Sentinel for this phase. Heal 3 damage from a friendly unit or
//    base. Defeat an enemy unit with 3 or less remaining HP."

const VD = Cards.events.ic27.vigilantDefense;
const MARINE = Cards.units.sor.battlefieldMarine;       // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce; // 3/7

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .WithCardInHandForPlayer(1, VD);
}

const pick = (g: GameTestAdapter, playId: string) => g.dispatchAsync(1, "choose-target", { targetPlayIds: [playId] });
const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? [...(res.fromPlayIds ?? [])].sort() : [];
};

describe("IC27_046 Vigilant Defense", () => {
  it("buffs a friendly unit, heals the same unit, and defeats an enemy unit with ≤3 remaining HP", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, SECURITY, true, 4)
      .WithGroundUnitForPlayer(2, MARINE)          // 3 remaining
      .WithGroundUnitForPlayer(2, SECURITY)        // 7 remaining — not offered
      .Build());
    const mine = g.state.player1.groundArena[0].playId;
    const weak = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await pick(g, mine);   // +0/+3 and Sentinel
    await pick(g, mine);   // heal 3
    expect(offered(g)).toEqual([weak]);
    await pick(g, weak);   // defeat

    const unit = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(unit.TotalHP()).toBe(10);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
    expect(HasSentinel(unit.cardId, unit.playId, 1)).toBe(true);
    expect(g.state.player2.groundArena.map(u => u.cardId)).toEqual([SECURITY]);
  });

  it("the heal may go to your base instead (sent as the UI's base pick)", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, MARINE, true, 1).Build();
    state.player1.base.damage = 5;
    g.loadNewState(state);
    const mine = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await pick(g, mine);
    expect(offered(g)).toEqual([mine, "player1.base"].sort());
    await g.chooseBaseAsync(1, 1);

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("the heal may go to your base as a playId too", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(1, MARINE).Build();
    state.player1.base.damage = 5;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    await pick(g, g.state.player1.groundArena[0].playId);
    await pick(g, "player1.base");

    expect(g.state.player1.base.damage).toBe(2);
  });

  it("with no friendly unit the buff is skipped; the heal and defeat still happen", async () => {
    const g = new GameTestAdapter();
    const state = board().WithGroundUnitForPlayer(2, MARINE).Build();
    state.player1.base.damage = 5;
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    expect(offered(g)).toEqual(["player1.base"]);
    await pick(g, "player1.base");
    await pick(g, g.state.player2.groundArena[0].playId);

    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("with nothing damaged the heal is skipped and the defeat comes next", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SECURITY).WithGroundUnitForPlayer(2, MARINE).Build());
    const weak = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await pick(g, g.state.player1.groundArena[0].playId);
    expect(offered(g)).toEqual([weak]);
    await pick(g, weak);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("the +0/+3 keeps a heavily damaged unit alive", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SECURITY, true, 6).Build());
    const mine = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await pick(g, mine);
    await pick(g, mine);

    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentHP()).toBe(7);
  });

  it("enemy ground attackers are offered only the Sentinel for the rest of the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board()
      .WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(1, SECURITY)
      .WithGroundUnitForPlayer(2, SECURITY)
      .Build());
    const marine = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await pick(g, marine);
    await g.attackWithGroundUnitAsync(2, 0);

    expect(offered(g)).toEqual([marine]);
  });
});
