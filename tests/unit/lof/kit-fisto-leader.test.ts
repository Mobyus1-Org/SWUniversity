import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// LOF_011 Kit Fisto (Focused Jedi Master) — 1/6 Ground leader, cost 5.
// FRONT:    Action [1 resource, Exhaust]: If you attacked with a Jedi unit this phase, deal 2 damage to a unit.
// DEPLOYED: Saboteur
//           This unit gets +1/+0 for each other friendly Jedi unit.

function frontState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.lof.kitFisto)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithActivePlayer(1);
}

describe("LOF_011 Kit Fisto — leader (front) ability", () => {
  it("deals 2 damage to a chosen unit after a Jedi unit attacked this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // Jedi
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 — survives to be checked
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // Gungi (Jedi) attacks
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // 2 from Gungi's attack + 2 from the leader ability.
    expect(g.state.player2.groundArena[0].damage).toBe(4);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 1); // 1 resource
  });

  it("can target a friendly unit ('a unit', either side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 1);

    expect(g.state.player1.groundArena[1].damage).toBe(2);
  });

  it("soft-passes when no Jedi unit attacked this phase — no damage, cost still paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // NOT a Jedi
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0); // a non-Jedi attack
    await g.chooseGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "pass-action", {});

    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // no target prompt
    expect(g.state.player2.groundArena[0].damage).toBe(3); // only the Marine's attack damage
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 1);
  });

  it("soft-passes when nothing attacked at all this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi)
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("an ENEMY Jedi attack does not enable it ('you attacked')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontState()
        .WithGroundUnitForPlayer(2, Cards.units.lof.gungi) // enemy Jedi
        .WithGroundUnitForPlayer(1, Cards.units.sor.consularSecurityForce)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0);

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].damage).toBe(2); // only Gungi's attack
  });
});

describe("LOF_011 Kit Fisto — deployed leader unit", () => {
  function deployedState() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.lof.kitFisto, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.leaders.lof.kitFisto)
      .WithActivePlayer(1);
  }

  it("has base power with no other friendly Jedi", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(1);
  });

  it("gets +1/+0 for each OTHER friendly Jedi unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedState()
        .WithGroundUnitForPlayer(1, Cards.units.lof.gungi) // Jedi
        .WithGroundUnitForPlayer(1, Cards.units.sor.obiWanKenobi) // Jedi
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Jedi
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3); // 1 + 2
  });

  it("does not count enemy Jedi units", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedState()
        .WithGroundUnitForPlayer(2, Cards.units.lof.gungi)
        .WithGroundUnitForPlayer(2, Cards.units.sor.obiWanKenobi)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(1);
  });

  it("does not count itself ('each OTHER friendly Jedi unit')", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().WithGroundUnitForPlayer(1, Cards.units.lof.gungi).Build());

    // Kit Fisto is himself a Jedi; only Gungi counts.
    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(2);
  });

  it("HP is unaffected (+1/+0, not +1/+1)", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().WithGroundUnitForPlayer(1, Cards.units.lof.gungi).Build());

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).TotalHP()).toBe(6);
  });

  it("loses the bonus when it loses its abilities", () => {
    const g = new GameTestAdapter();
    const state = deployedState().WithGroundUnitForPlayer(1, Cards.units.lof.gungi).Build();
    const kitPlayId = state.player1.groundArena[0].playId;
    state.currentEffects.push({
      cardId: Cards.events.law.theTreeRemembers, // "loses all abilities for this phase"
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: kitPlayId,
    });
    g.loadNewState(state);

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(1);
  });

  it("has Saboteur", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    const u = g.state.player1.groundArena[0];
    expect(HasSaboteur(u.cardId, u.playId, 1)).toBe(true);
  });
});
