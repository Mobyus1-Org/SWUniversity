import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Leader Action abilities that used to pay their cost and do nothing.
//
// SOR_018 Jyn Erso        — Attack with a unit. The defender gets -1/-0 for this attack.
// SHD_007 Moff Gideon     — Attack with a unit that costs 3 or less. If it's attacking a unit, +1/+0.
// SHD_002 Qi'ra           — Deal 2 damage to a friendly unit. Then, give a Shield token to it.
// SHD_010 Bossk           — Deal 1 damage to a unit with a Bounty. You may give it +1/+0 this phase.
// SOR_013 Cassian Andor   — If you've dealt 3+ damage to an enemy base this phase, draw a card.

const SHIELD = Cards.upgrades.token.shield;

function setup(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("SOR_018 Jyn Erso", () => {
  it("attacks with the chosen unit and gives the defender -1/-0 for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.jynErso)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3/3 → 2/3 while debuffed
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // attacker
    await g.chooseGroundUnitAsync(2, 0); // defender

    // Attacker took only 2 (defender debuffed to 2 power) and survived; defender took 3 and died.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(2);
  });

  it("does not debuff when attacking a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.jynErso)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });
});

describe("SHD_007 Moff Gideon", () => {
  it("only offers units costing 3 or less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.moffGideon)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // cost 2
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // cost 5
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    const marine = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!;
    expect(targets).toEqual([marine.playId]);
  });

  it("gives +1/+0 when attacking a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.moffGideon)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3 → 4 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(4); // 3 + 1
  });

  it("does NOT give +1/+0 when attacking a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.moffGideon)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // unbuffed
  });
});

describe("SHD_002 Qi'ra", () => {
  it("deals 2 damage to a friendly unit then Shields it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.qira)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 7 HP — survives
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    const unit = g.state.player1.groundArena[0];
    expect(unit.damage).toBe(2);
    expect(unit.upgrades.filter(u => u.cardId === SHIELD)).toHaveLength(1);
  });

  it("cannot target an enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.qira)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([g.state.player1.groundArena[0].playId]);
  });
});

describe("SHD_010 Bossk", () => {
  it("deals 1 damage to a unit with a Bounty and may buff it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.bossk)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // no Bounty
        .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer) // innate Bounty, 4 HP
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    const enforcer = g.state.player2.groundArena[0];
    expect(targets).toEqual([enforcer.playId]); // only the bountied unit

    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enforcer.playId] });
    expect(g.state.player2.groundArena[0].damage).toBe(1);

    await g.chooseYesAsync(1); // take the optional +1/+0
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("soft-passes when no unit has a Bounty", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.bossk)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false); // cost still paid
  });

  it("may decline the +1/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.shd.bossk)
        .WithGroundUnitForPlayer(2, Cards.units.shd.hylobonEnforcer)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });
});

describe("SOR_013 Cassian Andor", () => {
  it("draws a card after dealing 3+ damage to the enemy base this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.cassianAndor)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // 3 damage to the enemy base
    await g.dispatchAsync(2, "pass-action", {});

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.hand).toHaveLength(1);
  });

  it("soft-passes when less than 3 damage was dealt to the enemy base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(Cards.leaders.sor.cassianAndor)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.leader.ready).toBe(false); // cost still paid
  });

  it("does not count damage dealt to your OWN base", async () => {
    const g = new GameTestAdapter();
    const state = setup(Cards.leaders.sor.cassianAndor)
      .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    state.roundState.baseDamagedThisPhase = [{ byPlayer: 1, target: 1, amount: 5 }];
    g.loadNewState(state);

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player1.hand).toHaveLength(0);
  });
});
