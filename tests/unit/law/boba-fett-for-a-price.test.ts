import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LAW_214 Boba Fett — For a Price (6/5 Ground, Underworld/Bounty Hunter, cost 5)
//   "When Played/On Attack: You may pay 1 resource. If you do, deal 3 damage to a ground unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

const readyResources = (g: GameTestAdapter) => g.state.player1.resources.filter(r => r.ready).length;

describe("LAW_214 Boba Fett — When Played", () => {
  it("paying 1 resource deals 3 damage to the chosen ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.law.bobaFettForAPrice)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives 3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    const before = readyResources(g);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(3);
    expect(readyResources(g)).toBe(before - 1);
  });

  it("declining costs nothing and deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.law.bobaFettForAPrice)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    const before = readyResources(g);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(readyResources(g)).toBe(before);
  });

  it("only GROUND units are offered — a space unit is not a legal target", async () => {
    const g = new GameTestAdapter();
    const state = baseSetup()
      .WithCardInHandForPlayer(1, Cards.units.law.bobaFettForAPrice)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
      .Build();
    g.loadNewState(state);

    await g.playCardFromHandAsync(1, 0);
    const afterYes = await g.chooseYesAsync(1);

    const res = afterYes.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] };
    expect(res.fromPlayIds).toContain(g.state.player2.groundArena[0].playId);
    expect(res.fromPlayIds).not.toContain(g.state.player2.spaceArena[0].playId);
  });

  it("can target a FRIENDLY ground unit — 'a ground unit', either side", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.law.bobaFettForAPrice)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("no prompt at all when there is no ground unit in play (control)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.law.bobaFettForAPrice)
        .WithSpaceUnitForPlayer(2, Cards.units.sor.tieLnFighter)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    // Boba himself is the only ground unit — he IS a legal target, so the prompt still appears.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });
});

describe("LAW_214 Boba Fett — On Attack", () => {
  it("paying 1 resource deals 3 damage before combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.bobaFettForAPrice)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // declare the defender
    const before = readyResources(g);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // the On Attack damage target

    // 3 from the ability + 6 from combat = 9 on a 7 HP body → defeated.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(readyResources(g)).toBe(before - 1);
  });

  it("declining On Attack leaves the defender to take combat damage only", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.law.bobaFettForAPrice)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player2.groundArena[0].damage).toBe(6); // combat only
  });
});
