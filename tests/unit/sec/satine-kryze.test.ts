import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// SEC_005 Satine Kryze — Standing on Principles (leader; deployed 0/8 Ground, Mandalorian/Official)
// FRONT:    "Action [Exhaust]: Heal up to 2 damage from a unit. If you do, deal that much damage
//            to your base."
//           "Epic Action: If you control 5 or more resources, deploy this leader."
// DEPLOYED: "Restore 4"

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sec.satineKryze)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8);
}

describe("SEC_005 Satine Kryze — leader side Action", () => {
  it("heals 2 from a friendly unit and deals 2 to YOUR OWN base", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 3)
      .Build();
    g.loadNewState(state);
    const targetPlayId = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [{ playId: targetPlayId, damage: 2 }] });

    expect(g.state.player1.groundArena[0].damage).toBe(1); // 3 − 2
    expect(g.state.player1.base.damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(0); // never the opponent's base
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("healing only 1 deals only 1 to your base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 1).Build());
    const targetPlayId = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [{ playId: targetPlayId, damage: 1 }] });

    expect(g.state.player1.groundArena[0].damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(1);
  });

  it("healing nothing ('up to 2') costs your base nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 3).Build());

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [] });

    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(0);
  });

  it("can heal an ENEMY unit — 'a unit', either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true, 2).Build());
    const targetPlayId = g.state.player2.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [{ playId: targetPlayId, damage: 2 }] });

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player1.base.damage).toBe(2); // still YOUR base that pays
  });

  it("cannot heal more than the damage actually on the unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, true, 1).Build());
    const targetPlayId = g.state.player1.groundArena[0].playId;

    await g.useLeaderAbilityAsync(1);
    const bad = await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [{ playId: targetPlayId, damage: 2 }] });

    expect(bad.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.base.damage).toBe(0);
  });
});

describe("SEC_005 Satine Kryze — deployed side", () => {
  it("has Restore 4", () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    expect(RestoreAmount(Cards.leaders.sec.satineKryze)).toBe(4);
  });
});
