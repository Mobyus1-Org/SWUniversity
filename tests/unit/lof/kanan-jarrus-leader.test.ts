import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// LOF_004 Kanan Jarrus (Help Us Survive) — 3/6 Ground leader, cost 6.
// FRONT:    Action [1 resource, Exhaust]: Give a Shield token to a Creature or Spectre unit.
// DEPLOYED: Shielded
//           While you control another Creature or Spectre unit, this unit gets +2/+2.

function frontState() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.lof.kananJarrus)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
    .WithActivePlayer(1);
}

const shieldsOn = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === Cards.upgrades.token.shield).length;

describe("LOF_004 Kanan Jarrus — leader (front) ability", () => {
  it("gives a Shield token to a friendly Spectre unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus).Build());

    const readyBefore = g.state.player1.resources.filter(r => r.ready).length;
    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(1, 0);

    expect(shieldsOn(g.state.player1.groundArena[0])).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(readyBefore - 1); // 1 resource
  });

  it("gives a Shield token to a Creature unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseSpaceUnitAsync(1, 0);

    expect(shieldsOn(g.state.player1.spaceArena[0])).toBe(1);
  });

  it("can shield an ENEMY Creature or Spectre unit ('a … unit', unrestricted side)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer).Build());

    await g.useLeaderAbilityAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(shieldsOn(g.state.player2.spaceArena[0])).toBe(1);
  });

  it("cannot target a unit that is neither Creature nor Spectre", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      frontState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // Rebel Trooper
        .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus) // Spectre — keeps the prompt live
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    const marinePlayId = g.state.player1.groundArena[0].playId;
    const result = await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marinePlayId] });

    expect(result.lastDispatchResponse?.invalidAction).toBe(true);
    expect(shieldsOn(g.state.player1.groundArena[0])).toBe(0);
  });

  it("is not offered when no Creature or Spectre unit is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(frontState().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build());

    await g.useLeaderAbilityAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.leader.ready).toBe(true); // nothing spent
  });
});

describe("LOF_004 Kanan Jarrus — deployed leader unit", () => {
  function deployedState() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.lof.kananJarrus, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.leaders.lof.kananJarrus)
      .WithActivePlayer(1);
  }

  it("has base stats with no other Creature or Spectre unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build());

    const kanan = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(kanan.CurrentPower()).toBe(3);
    expect(kanan.TotalHP()).toBe(6);
  });

  it("gets +2/+2 while you control another Spectre unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus).Build());

    const kanan = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(kanan.CurrentPower()).toBe(5);
    expect(kanan.TotalHP()).toBe(8);
  });

  it("gets +2/+2 while you control a Creature unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer).Build());

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(5);
  });

  it("the bonus does not stack — it is a while-condition, not per unit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedState()
        .WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus)
        .WithSpaceUnitForPlayer(1, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(5);
  });

  it("an ENEMY Creature or Spectre unit does not grant it ('you control')", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer).Build());

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });

  it("does not count itself ('another')", () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedState().Build()); // Kanan is himself a Spectre

    expect(Unit.FromInterface(g.state.player1.groundArena[0]).CurrentPower()).toBe(3);
  });

  it("loses the bonus when it loses its abilities", () => {
    const g = new GameTestAdapter();
    const state = deployedState().WithGroundUnitForPlayer(1, Cards.units.sor.kananJarrus).Build();
    state.currentEffects.push({
      cardId: Cards.events.law.theTreeRemembers,
      duration: "Phase",
      affectedPlayer: 1,
      targetPlayId: state.player1.groundArena[0].playId,
    });
    g.loadNewState(state);

    const kanan = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(kanan.CurrentPower()).toBe(3);
    expect(kanan.TotalHP()).toBe(6);
  });
});
