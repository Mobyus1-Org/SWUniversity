import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LAW_127 Kill Switch (Upgrade, Vigilance, cost 2, –1/–1, Condition) —
//   "When Played: Exhaust attached unit."
// Same text as ASH_228 Preparation.

const KILL_SWITCH = Cards.upgrades.law.killSwitch;
const HOST = Cards.units.sor.consularSecurityForce; // 3/7

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.leiaOrgana)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithCardInHandForPlayer(1, KILL_SWITCH)
    .WithGroundUnitForPlayer(1, HOST)
    .WithGroundUnitForPlayer(2, HOST)
    .WithActivePlayer(1);
}

describe("LAW_127 Kill Switch", () => {
  it("exhausts an enemy unit it is attached to, and gives it –1/–1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    expect(g.state.player2.groundArena[0].ready).toBe(true);

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    const host = g.state.player2.groundArena[0];
    expect(host.upgrades.some(u => u.cardId === KILL_SWITCH)).toBe(true);
    expect(host.ready).toBe(false);
    expect(Unit.FromInterface(host).CurrentPower()).toBe(2);
    expect(Unit.FromInterface(host).CurrentHP()).toBe(6);
    expect(g.state.player1.groundArena[0].ready).toBe(true); // only the attached unit
  });

  it("exhausts a friendly unit too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[0].ready).toBe(true);
  });
});
