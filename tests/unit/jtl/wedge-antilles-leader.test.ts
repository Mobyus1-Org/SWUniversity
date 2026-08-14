import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_008 Wedge Antilles (Leader of Red Squadron) — Leader (Command/Heroism), cost 5, deployed 3/6 ground.
// Leader side:
//   "Action [Exhaust]: Play a card from your hand using Piloting. It costs 1 resource less."
//   "Epic Action: If you control 5 or more resources, choose one:
//     Deploy this leader. / Deploy this leader as an upgrade on a friendly Vehicle unit without
//     a Pilot on it."
// Deployed side (and as a Pilot upgrade, granted to the attached unit):
//   "On Attack: The next Pilot card you play this phase costs 1 resource less. (This includes
//    Piloting costs.)"

function leaderSetup(resourceCount = 5) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.jtl.wedgeAntilles)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, resourceCount);
}

describe("JTL_008 Wedge Antilles — Epic Action (deploy as unit or Pilot upgrade)", () => {
  it("cannot deploy with fewer than 5 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(leaderSetup(4).Build());

    await g.deployLeaderAsync(1);

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
    expect(g.state.player1.leader.deployed).toBe(false);
  });

  it("deploys as a ground unit with 5+ resources and no eligible Vehicle", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(leaderSetup(5).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.wedgeAntilles)).toBe(true);
  });

  it("offers the unit-or-pilot choice when a friendly Vehicle without a Pilot is in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      leaderSetup(5).WithGroundUnitForPlayer(1, Cards.units.sor.reinforcementWalker).Build(),
    );

    await g.deployLeaderAsync(1);

    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });
});

// Nien Nunb JTL_093 — "Piloting [1 resource Command Heroism]". Wedge's leader aspects are
// Command/Heroism, so the piloting cost carries no aspect penalty here: 1 resource, 0 with
// Wedge's discount.
describe("JTL_008 Wedge Antilles — Action: play a card from hand using Piloting at −1", () => {
  function actionSetup() {
    const g = new GameTestAdapter();
    g.loadNewState(
      leaderSetup(5)
        .WithCardInHandForPlayer(1, Cards.units.jtl.nienNunb)
        .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
        .WithActivePlayer(1)
        .Build(),
    );
    return g;
  }

  it("plays the chosen Piloting card as a Pilot upgrade for 1 less", async () => {
    const g = actionSetup();

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === Cards.units.jtl.nienNunb)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(5); // 1 − 1 = 0 paid
    expect(g.state.player1.leader.ready).toBe(false); // Exhaust cost
  });

  // Control: the same pilot play WITHOUT Wedge's action pays the full piloting cost.
  it("the same pilot play without the action costs 1", async () => {
    const g = actionSetup();

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === Cards.units.jtl.nienNunb)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(4); // paid 1
  });

  it("a non-Piloting card cannot be chosen", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      leaderSetup(5)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.units.jtl.nienNunb)
        .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0); // Battlefield Marine — no Piloting

    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("is unavailable with no Piloting card in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      leaderSetup(5)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
        .WithActivePlayer(1)
        .Build(),
    );

    const used = await g.useLeaderAbilityAsync(1);

    expect(used.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.leader.ready).toBe(true);
  });
});

// Deployed side — "On Attack: The next Pilot card you play this phase costs 1 resource less.
// (This includes Piloting costs.)"
// Nien Nunb (JTL_093): unit cost 1, Piloting [1 resource] — both Command/Heroism, fully covered
// by Wedge's leader aspects, so no aspect penalties muddy the arithmetic.
describe("JTL_008 Wedge Antilles — deployed On Attack: next Pilot card costs 1 less", () => {
  function deployedSetup() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.jtl.wedgeAntilles, true, true) // deployed
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
      .WithGroundUnitForPlayer(1, Cards.leaders.jtl.wedgeAntilles) // the leader unit
      .WithCardInHandForPlayer(1, Cards.units.jtl.nienNunb);
  }

  async function attackBaseAndPass(g: GameTestAdapter, groundIndex = 0) {
    await g.attackWithGroundUnitAsync(1, groundIndex);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
  }

  it("after Wedge attacks, the next Pilot unit played costs 1 less", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().WithActivePlayer(1).Build());

    await attackBaseAndPass(g);
    await g.playCardFromHandAsync(1, 0); // Nien Nunb as a unit: 1 − 1 = 0

    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.jtl.nienNunb)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(5);
  });

  it("control: without the attack the same Pilot unit costs its full 1", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedSetup().WithActivePlayer(1).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(4);
  });

  it("the discount applies to Piloting costs too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedSetup().WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet).WithActivePlayer(1).Build(),
    );

    await attackBaseAndPass(g);
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot"); // Piloting 1 − 1 = 0
    await g.choosePilotVehicleSpaceAsync(1, 0);

    expect(g.state.player1.spaceArena[0].upgrades.some(u => u.cardId === Cards.units.jtl.nienNunb)).toBe(true);
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(5);
  });

  // "The NEXT Pilot card" — a non-Pilot play in between neither benefits nor consumes it.
  it("a non-Pilot card is not discounted and leaves the marker armed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      deployedSetup().WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine).WithActivePlayer(1).Build(),
    );

    await attackBaseAndPass(g);
    await g.playCardFromHandAsync(1, 1); // Battlefield Marine, cost 2 — full price
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(3);

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // Nien Nunb still 1 − 1 = 0
    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(3);
  });

  it("as a Pilot upgrade, the piloted Vehicle's attack arms the same discount", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.wedgeAntilles, true, true)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 5)
        .WithSpaceUnitForPlayer(1, Cards.units.law.mercenaryFleet)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.leaders.jtl.wedgeAntilles, 1), // Wedge piloting
        ])
        .WithCardInHandForPlayer(1, Cards.units.jtl.nienNunb)
        .WithActivePlayer(1)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0); // the Fleet, piloted by Wedge
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0); // Nien Nunb as a unit: 1 − 1 = 0 (Fleet already has a Pilot)

    expect(g.state.player1.resources.filter(r => r.ready).length).toBe(5);
  });
});
