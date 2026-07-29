import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_124 Niman Strike — cost 1 Command event.
// "Attack with a Force unit, even if it's exhausted. It gets +1/+0 and can't attack bases
//  for this attack."

function baseState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.events.lof.nimanStrike);
}

describe("LOF_124 Niman Strike", () => {
  it("attacks with an EXHAUSTED Force unit and applies +1/+0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi, false) // 2/5, exhausted
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards) // 4/4
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // choose the attacker
    await g.chooseGroundUnitAsync(2, 0); // choose the defender

    expect(g.state.player2.groundArena[0].damage).toBe(3); // 2 power + 1
    expect(g.state.player1.groundArena[0].damage).toBe(4); // counter-damage
  });

  it("works with a ready Force unit, which ends the attack exhausted", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi, true)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("cannot attack a base — Base is not offered and choosing it is rejected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi, false)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const resolution = g.lastDispatchResponse?.resolutionNeeded as { fromZones?: string[] };
    expect(resolution.fromZones ?? []).not.toContain("Base");

    const result = await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] });
    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("cannot choose a non-Force friendly unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel Trooper, not Force
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const marinePlayId = g.state.player1.groundArena[0].playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("cannot choose an ENEMY Force unit ('attack with' means your own)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
        .WithGroundUnitForPlayer(2, Cards.units.lof.gungi)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const enemyGungi = g.state.player2.groundArena[0].playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyGungi] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("does not prompt when you control no Force unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("the buff and the base restriction expire with the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi, true)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true)
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    expect(g.state.player2.groundArena[0].damage).toBe(3);

    // A different unit's normal attack afterwards can still hit the base: the "can't attack bases"
    // effect was scoped to the Niman Strike attack only.
    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetZones: ["Base"] });

    expect(g.state.player2.base.damage).toBe(3); // Battlefield Marine's 3 power, unbuffed
  });
});
