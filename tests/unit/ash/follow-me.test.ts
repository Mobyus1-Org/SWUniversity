import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { ADVANTAGE_TOKEN } from "@/server/engine/token-helpers";
import { Cards } from "../../card-helpers";

// ASH_184 Follow Me (Event, cost 1)
// "Attack with a unit. After completing the attack, give 3 Advantage tokens to a unit."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_184 Follow Me", () => {
  it("attacks with the chosen unit, then gives 3 Advantage tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.followMe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce) // 3/7
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // attacker
    await g.chooseBaseAsync(1, 2);       // attack the enemy base
    await g.chooseGroundUnitAsync(1, 0); // token recipient

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(3);
  });

  it("exhausts the attacker as a normal attack does", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.followMe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseGroundUnitAsync(1, 0);

    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("does not offer a unit that died during the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.followMe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)      // 3/3 — trades and dies
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)  // survivor
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)      // 3/3 — also dies
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // the Marine attacks
    await g.chooseGroundUnitAsync(2, 0); // into the enemy Marine — both die

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    const survivor = g.state.player1.groundArena[0];
    expect(g.state.player1.groundArena).toHaveLength(1);
    expect(targets).toEqual([survivor.playId]);

    await g.chooseGroundUnitAsync(1, 0);
    expect(g.state.player1.groundArena[0].upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(3);
  });

  it("can give the tokens to an ENEMY unit (the clause says 'a unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.followMe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].upgrades.filter(u => u.cardId === ADVANTAGE_TOKEN)).toHaveLength(3);
  });

  it("offers only READY friendly units as the attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.followMe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, false) // exhausted
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, true)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const targets = (g.lastDispatchResponse?.resolutionNeeded as { fromPlayIds?: string[] }).fromPlayIds!;
    expect(targets).toEqual([
      g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!.playId,
    ]);
  });

  it("does nothing when the caster has no ready unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.followMe)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce, false)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
