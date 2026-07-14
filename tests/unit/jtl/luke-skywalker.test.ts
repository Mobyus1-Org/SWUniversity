import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { NeedsOption } from "@/lib/engine/message-types";

// JTL_012 Luke Skywalker — Hero of Yavin (5/6 Ground, Force/Rebel/Pilot)
// Leader:      "Action [Exhaust]: If you attacked with a Fighter unit this phase, deal 1 damage to a unit."
//              "Epic Action: If you control 6 or more resources, choose one:
//               Deploy this leader. / Deploy this leader as an upgrade on a friendly Vehicle
//               unit without a Pilot on it."
// As upgrade:  "This upgrade can't be defeated by enemy card abilities."
//              "Attached unit is a leader unit. If it's a Fighter, it gains:
//               'On Attack: You may deal 3 damage to a unit.'"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.jtl.lukeSkywalker)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8) // ≥6 to deploy
    .WithInitiativePlayerBeing(2)
    .WithInitiativeClaimed(); // player 2 auto-passes so player 1 can act twice
}

describe("JTL_012 Luke Skywalker — Leader ability", () => {
  it("deals 1 damage to a unit after a Fighter attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.blueLeader) // Fighter
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0); // a Fighter attacks
    await g.chooseBaseAsync(1, 2);

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false); // exhausted
  });

  it("soft-passes when the unit that attacked was not a Fighter", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Fighter
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.leader.ready).toBe(false); // still exhausts, like Iden Versio
  });

  it("soft-passes when nothing attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});

describe("JTL_012 Luke Skywalker — Epic Action deploy choice", () => {
  it("offers 'Deploy as Pilot' when a friendly Vehicle without a Pilot is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.jtl.blueLeader).Build());

    await g.deployLeaderAsync(1);

    const resolution = g.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Option");
    expect((resolution as NeedsOption)?.options).toContain("Deploy as Pilot");
  });

  it("deploys normally as a unit when no Vehicle is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(
      g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.lukeSkywalker),
    ).toBe(true);
  });

  it("attaches to the chosen Vehicle when 'Deploy as Pilot' is chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.jtl.blueLeader).Build());

    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "Deploy as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    const vehicle = g.state.player1.spaceArena[0];
    expect(vehicle.upgrades.map(u => u.cardId)).toContain(Cards.leaders.jtl.lukeSkywalker);
    expect(g.state.player1.groundArena).toHaveLength(0); // not deployed as a unit
  });
});

describe("JTL_012 Luke Skywalker — as a Pilot upgrade", () => {
  async function deployLukeOnto(g: GameTestAdapter, vehicleIsFighter: boolean) {
    const vehicle = vehicleIsFighter
      ? Cards.units.jtl.blueLeader // Fighter, 3/3
      : Cards.units.jtl.millenniumFalcon; // Vehicle/Transport — NOT a Fighter
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, vehicle)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // a damage target
        .Build(),
    );
    await g.deployLeaderAsync(1);
    await g.chooseOptionAsync(1, "Deploy as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
  }

  it("makes the attached Fighter gain 'On Attack: You may deal 3 damage to a unit'", async () => {
    const g = new GameTestAdapter();
    await deployLukeOnto(g, true);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1); // "You may deal 3 damage to a unit"
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("the granted On Attack is optional — declining deals no damage", async () => {
    const g = new GameTestAdapter();
    await deployLukeOnto(g, true);

    const attacked = await g.attackWithSpaceUnitAsync(1, 0);
    expect(attacked.lastDispatchResponse?.resolutionNeeded).toBeDefined();
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("does NOT grant the On Attack when the attached Vehicle is not a Fighter", async () => {
    const g = new GameTestAdapter();
    await deployLukeOnto(g, false); // Millennium Falcon — a Transport

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // No On-Attack prompt: the enemy unit is untouched and the attack is over.
    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBeGreaterThan(0); // the attack itself resolved
  });

  it("makes the attached unit a leader unit", async () => {
    const g = new GameTestAdapter();
    await deployLukeOnto(g, true);

    // Vanquish defeats "a non-leader unit" — the piloted vehicle is now a LEADER unit,
    // so it must not be a legal target.
    g.state.player2.hand.push({ cardId: Cards.events.sor.vanquish });
    const vehiclePlayId = g.state.player1.spaceArena[0].playId;
    await g.dispatchAsync(1, "pass-action", {});
    await g.playCardFromHandAsync(2, 0);
    const result = await g.dispatchAsync(2, "choose-target", { targetPlayIds: [vehiclePlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.spaceArena).toHaveLength(1); // survived
  });

  it("cannot be defeated by an enemy card ability (Confiscate)", async () => {
    const g = new GameTestAdapter();
    await deployLukeOnto(g, true);

    // Player 2 plays Confiscate ("Defeat an upgrade") — Luke must not be a legal target.
    g.state.player2.hand.push({ cardId: Cards.events.sor.confiscate });
    for (const r of g.state.player2.resources) r.ready = true;
    const lukeUpgradePlayId = g.state.player1.spaceArena[0].upgrades.find(
      u => u.cardId === Cards.leaders.jtl.lukeSkywalker,
    )!.playId;

    await g.dispatchAsync(1, "pass-action", {});
    await g.playCardFromHandAsync(2, 0);
    const result = await g.dispatchAsync(2, "choose-target", { targetPlayIds: [lukeUpgradePlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(
      g.state.player1.spaceArena[0].upgrades.some(
        u => u.cardId === Cards.leaders.jtl.lukeSkywalker,
      ),
    ).toBe(true); // still attached
  });
});
