import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// TWI_011 Ahsoka Tano — Snips (3/6 Ground, Force/Jedi/Republic)
// Leader:   "Coordinate — Action [Exhaust]: Attack with a unit. It gets +1/+0 for this attack.
//            (Gain this ability while you control 3 or more units.)"
// Deployed: "Coordinate — This unit gets +2/+0."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.twi.ahsokaTano)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 10);
}

describe("TWI_011 Ahsoka Tano — Leader ability (Coordinate)", () => {
  it("attacks with a chosen unit, which gets +1/+0 for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        // 3 units → Coordinate is active
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3 power → 4 with the buff
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards)
        .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // attack with the Marine
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4); // 3 printed + 1 from Ahsoka
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
  });

  it("the +1/+0 lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper) // 3 power, attacks later unbuffed
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards)
        .WithInitiativePlayerBeing(2)
        .WithInitiativeClaimed()
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0); // buffed Marine attacks: 4
    await g.chooseBaseAsync(1, 2);

    await g.attackWithGroundUnitAsync(1, 1); // Death Trooper attacks: plain 3
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(7); // 4 + 3, not 4 + 4
  });

  it("is not available while you control fewer than 3 units (no Coordinate)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards) // only 2 units
        .Build(),
    );

    const result = await g.useLeaderAbilityAsync(1);

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.leader.ready).toBe(true); // not exhausted — the ability isn't gained
  });
});

describe("TWI_011 Ahsoka Tano — Deployed leader unit (Coordinate)", () => {
  it("gets +2/+0 while you control 3 or more units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.gamorreanGuards)
        .WithInitiativePlayerBeing(2)
        .WithInitiativeClaimed()
        .Build(),
    );

    await g.deployLeaderAsync(1); // Ahsoka enters → 3 units → Coordinate active

    const ahsokaIdx = g.state.player1.groundArena.findIndex(
      u => u.cardId === Cards.leaders.twi.ahsokaTano,
    );
    await g.attackWithGroundUnitAsync(1, ahsokaIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // 3 printed + 2 from Coordinate
  });

  it("does not get +2/+0 while you control fewer than 3 units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithInitiativePlayerBeing(2)
        .WithInitiativeClaimed()
        .Build(),
    );

    await g.deployLeaderAsync(1); // only 2 units → Coordinate inactive

    const ahsokaIdx = g.state.player1.groundArena.findIndex(
      u => u.cardId === Cards.leaders.twi.ahsokaTano,
    );
    await g.attackWithGroundUnitAsync(1, ahsokaIdx);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // printed power only
  });
});
