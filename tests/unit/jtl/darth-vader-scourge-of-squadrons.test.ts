import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasOnAttack } from "@/server/engine/core-functions";

// JTL_142 Darth Vader - Scourge of Squadrons (7/7 Ground unit, cost 6) —
//   "Piloting [3 resources, Aggression Villainy]
//    Attached unit gains: 'On Attack: You may deal 1 damage to a unit. If a unit is defeated
//    this way, you may deal 1 damage to a unit or base.'"
//
// Host: Phoenix Squadron A-Wing (JTL_095) — 3/2 Space Vehicle with no abilities of its own,
// so the only On Attack trigger in play is Vader's. With Vader (+3/+3) it attacks as a 6/5.

function boardWithVaderPilot(opts: { unpiloted?: boolean } = {}) {
  const b = new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing);
  if (!opts.unpiloted) {
    b.WithUpgradesOnSpaceUnitForPlayer(1, 0, [
      GameStateBuilder.Upgrade(Cards.units.jtl.darthVaderScourgeOfSquadrons, 1),
    ]);
  }
  return b;
}

describe("JTL_142 Darth Vader (Scourge of Squadrons) — Piloting-granted On Attack", () => {
  it("deals 1 damage to a chosen unit and stops there when nothing dies", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      boardWithVaderPilot()
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2, 2); // attack the enemy base
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    // Nothing was defeated, so the follow-up never triggers and combat has already resolved.
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(6); // the piloted 6/5 A-Wing's combat damage
  });

  it("offers a second damage to a UNIT when the first damage defeats one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      boardWithVaderPilot()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter) // 2/1 — dies to 1 damage
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — the second target
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2, 2);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0); // kill the TIE

    expect(g.state.player2.spaceArena.length).toBe(0);

    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(6); // combat still resolved afterwards
  });

  it("the second damage may go to a BASE instead — 'a unit or base'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      boardWithVaderPilot()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2, 2);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0); // kill the TIE

    await g.chooseYesAsync(1);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7); // 1 from the ability + 6 from combat
  });

  it("declining the first prompt deals no damage and never offers the second", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      boardWithVaderPilot()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2, 2);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined(); // the prompt existed
    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(6);
  });

  it("declining the second prompt after a kill leaves the extra damage undealt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      boardWithVaderPilot()
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2, 2);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeDefined(); // the follow-up prompt existed
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(6); // combat only
  });

  it("control: the same A-Wing without Vader has no On Attack trigger", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      boardWithVaderPilot({ unpiloted: true })
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(2, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(3); // the unpiloted 3/2 A-Wing
  });

  it("control: Vader played as a 7/7 unit has no On Attack of his own", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.jtl.darthVaderScourgeOfSquadrons)
        .Build(),
    );

    const vader = g.state.player1.groundArena[0];
    expect(HasOnAttack(vader.cardId, 1, vader.playId)).toBe(false);
  });
});
