import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// LAW_108 Lando Calrissian — Eyes Open (4/5 Ground, cost 5, Vigilance/Heroism, unique) —
//   Sentinel
//   "While this unit is defending, the attacker gets –1/–0."
// The second clause is JTL_054 Gold Leader's; the first is a plain printed Sentinel (Gold Leader
// has Shielded instead).

const LANDO = Cards.units.law.landoCalrissianEyesOpen;
const ATTACKER = Cards.units.sor.consularSecurityForce; // 3/7

function board(defender: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.leiaOrgana)
    .WithGroundUnitForPlayer(1, ATTACKER)
    .WithGroundUnitForPlayer(2, defender)
    .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
    .WithActivePlayer(1);
}

describe("LAW_108 Lando Calrissian — Sentinel", () => {
  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(LANDO).Build());
    const lando = g.state.player2.groundArena[0];
    expect(HasSentinel(lando.cardId, lando.playId, 2)).toBe(true);
  });

  it("enemy ground units must attack him, not the other unit or the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(LANDO).Build());
    const landoId = g.state.player2.groundArena[0].playId;
    const marineId = g.state.player2.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(landoId);
    expect(res.fromPlayIds).not.toContain(marineId);
  });
});

describe("LAW_108 Lando Calrissian — attacker gets –1/–0 while he defends", () => {
  it("a 3-power attacker deals only 2 to him; his counter-damage is unaffected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(LANDO).Build());
    const landoId = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [landoId] });

    expect(g.state.player2.groundArena.find(u => u.playId === landoId)!.damage).toBe(2);
    expect(g.state.player1.groundArena[0].damage).toBe(4);
  });

  it("control: the same attacker deals its full 3 to a unit without the clause", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(Cards.units.hmw.ewokBrigade).Build()); // 2/4, no text
    const defenderId = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderId] });

    expect(g.state.player2.groundArena.find(u => u.playId === defenderId)!.damage).toBe(3);
  });

  it("does not apply while Lando is the attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.leiaOrgana)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, LANDO)
        .WithGroundUnitForPlayer(2, ATTACKER)
        .WithActivePlayer(1)
        .Build(),
    );
    const defenderId = g.state.player2.groundArena[0].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [defenderId] });

    expect(g.state.player2.groundArena[0].damage).toBe(4);
  });
});
