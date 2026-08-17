import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_138 Sith Holocron — Upgrade (Sith/Item), cost 1, +1/+1
//   "Attach to a Force unit."
//   Attached unit gains: "On Attack: You may deal 2 damage to a friendly unit. If you do, this
//   unit gets +2/+0 for this attack."
//
// Darth Tyranus (LOF_231) is the host: Villainy/Force, so a legal attach target.

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

function withHolocron() {
  return baseSetup()
    .WithGroundUnitForPlayer(1, Cards.units.lof.darthTyranus)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, [
      GameStateBuilder.Upgrade(Cards.upgrades.lof.sithHolocron, 1),
    ]);
}

const host = (g: GameTestAdapter) =>
  g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.darthTyranus)!;

describe("LOF_138 Sith Holocron — attach restriction", () => {
  it("offers only Force units", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.upgrades.lof.sithHolocron)
      .WithGroundUnitForPlayer(1, Cards.units.lof.darthTyranus)       // Force
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)  // not Force
      .Build();
    g.loadNewState(state);

    const played = await g.playCardFromHandAsync(1, 0);

    const res = played.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(state.player1.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(state.player1.groundArena[1].playId);
  });
});

describe("LOF_138 Sith Holocron — granted On Attack", () => {
  it("accepting deals 2 to the chosen friendly unit and gives the host +2/+0 for the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withHolocron().WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 1); // the Consular Security Force takes the 2

    expect(g.state.player1.groundArena[1].damage).toBe(2);
    // Darth Tyranus is 4/3; +1/+1 from the Holocron = 5 power, +2 for this attack = 7 to the base.
    expect(g.state.player2.base.damage).toBe(7);
  });

  it("declining deals nothing and gives no buff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withHolocron().WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    const afterTarget = await g.chooseBaseAsync(1, 2);
    expect(afterTarget.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player1.groundArena[1].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(5); // 4 + 1 from the Holocron only
  });

  it("the host itself is a legal 'friendly unit' to damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withHolocron().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(host(g).damage).toBe(2);
    expect(g.state.player2.base.damage).toBe(7);
  });

  it("ENEMY units are not eligible — 'a friendly unit'", async () => {
    const g = new GameTestAdapter();
    const state = withHolocron().WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce).Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    const afterYes = await g.chooseYesAsync(1);

    const res = afterYes.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).not.toContain(state.player2.groundArena[0].playId);
  });

  it("the +2/+0 is ForAttack only — it is gone once the attack ends", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(withHolocron().Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(Unit.FromInterface(host(g)).CurrentPower()).toBe(5); // 4 + 1 from the upgrade, no +2
  });

  it("grants +1/+1 as a plain upgrade", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withHolocron().Build());

    expect(Unit.FromInterface(host(g)).CurrentPower()).toBe(5);
    expect(Unit.FromInterface(host(g)).TotalHP()).toBe(4);
  });
});
