import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_198 Dogged Pursuers (5/5 Ground, cost 5, Aggression, Underworld/Bounty Hunter)
//   "When Played: You may pay 1 resource. If you do, deal 2 damage to a ground unit."
// LAW_214 Boba Fett's When Played, for 2 damage instead of 3 — and with no On Attack half.

const PURSUERS = Cards.units.law.doggedPursuers;

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("LAW_198 Dogged Pursuers — When Played", () => {
  it("paying 1 resource deals 2 damage to the chosen ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, PURSUERS)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const before = readyResources(g);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
    expect(readyResources(g)).toBe(before - 1);
  });

  it("declining costs nothing and deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, PURSUERS)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const before = readyResources(g);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(readyResources(g)).toBe(before);
  });

  it("only GROUND units are offered — a space unit is not a legal target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, PURSUERS)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    const res = g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player2.spaceArena[0].playId);
  });

  it("no offer when there is no resource left to pay with (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.red30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(1)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5) // exactly its cost
        .WithCardInHandForPlayer(1, PURSUERS)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("has no On Attack — attacking with it offers nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(1, PURSUERS).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Target") await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(5);
  });
});
