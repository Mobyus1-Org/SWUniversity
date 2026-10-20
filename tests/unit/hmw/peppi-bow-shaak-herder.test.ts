import { describe, it, expect } from "vitest";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_073 Peppi Bow — Shaak Herder (Unit, cost 2, 2/3 Ground, Vigilance/Heroism, Gungan)
//   Restore 1
//   While this unit is upgraded, she gets +1/+1.
const PEPPI = Cards.units.hmw.peppiBow;
const UPGRADE = Cards.upgrades.sor.academyTraining; // +2/+2, no abilities of its own
const ENEMY = Cards.units.sor.battlefieldMarine;

function setup(myBaseDamage = 0) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, myBaseDamage) // Vigilance
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, ENEMY, 20);
}

const peppi = (g: GameTestAdapter) => Unit.FromInterface(g.state.player1.groundArena[0]);

describe("HMW_073 Peppi Bow — Shaak Herder", () => {
  it("has Restore 1", () => {
    expect(RestoreAmount(PEPPI)).toBe(1);
  });

  it("Restore 1: attacking heals 1 damage from your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(5).WithGroundUnitForPlayer(1, PEPPI).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4); // 5 - 1
  });

  it("is 2/3 while unupgraded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, PEPPI).Build());

    expect({ power: peppi(g).CurrentPower(), hp: peppi(g).TotalHP() }).toEqual({ power: 2, hp: 3 });
  });

  it("gets +1/+1 while upgraded — on top of the upgrade's own statline", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, PEPPI)
      .WithCardInHandForPlayer(1, UPGRADE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    // 2/3 printed, +2/+2 from Academy Training, +1/+1 from her own while-upgraded clause.
    expect({ power: peppi(g).CurrentPower(), hp: peppi(g).TotalHP() }).toEqual({ power: 5, hp: 6 });
  });

  it("the +1/+1 is once, not per upgrade", async () => {
    // "While this unit is upgraded" is a while-condition: two upgrades still only pay it once.
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, PEPPI)
      .WithCardInHandForPlayer(1, UPGRADE)
      .WithCardInHandForPlayer(1, UPGRADE)
      .Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });

    // 2/3 + 2/2 + 2/2 + 1/1 = 7/8 — NOT 8/9.
    expect({ power: peppi(g).CurrentPower(), hp: peppi(g).TotalHP() }).toEqual({ power: 7, hp: 8 });
  });

  it("the +1/+1 goes away when the last upgrade leaves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup()
      .WithGroundUnitForPlayer(1, PEPPI)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        { cardId: UPGRADE, playId: "u1", owner: 1, controller: 1 },
      ])
      .Build());

    expect({ power: peppi(g).CurrentPower(), hp: peppi(g).TotalHP() }).toEqual({ power: 5, hp: 6 });

    // Strip the upgrade and the while-condition stops paying.
    g.state.player1.groundArena[0].upgrades = [];
    expect({ power: peppi(g).CurrentPower(), hp: peppi(g).TotalHP() }).toEqual({ power: 2, hp: 3 });
  });
});
