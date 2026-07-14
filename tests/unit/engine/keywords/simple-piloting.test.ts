import { describe, expect, it } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { PilotingEligibleVehicles } from "@/server/engine/card-db/upgrade-attach-restrictions";
import { Cards } from "../../../card-helpers";
import { GameTestAdapter } from "../../game-test-adapter";

describe("PilotingEligibleVehicles", () => {
  it("returns vehicle playIds that have no PILOT upgrade", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(1);
    expect(eligible[0]).toBe(state.player1.spaceArena[0].playId);
  });

  it("excludes vehicles that already have a PILOT upgrade", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(0);
  });

  it("excludes non-Vehicle units", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(0);
  });

  it("Millennium Falcon with one PILOT upgrade is still eligible for a second pilot", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(1);
    expect(eligible[0]).toBe(state.player1.spaceArena[0].playId);
  });

  it("Millennium Falcon with two PILOT upgrades is no longer eligible", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
        GameStateBuilder.Upgrade(Cards.units.jtl.snapWexley, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(0);
  });

  it("R2-D2 aboard raises a normal vehicle's max from 1 to 2 — still eligible for one more pilot", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.units.jtl.r2d2, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(1);
  });

  it("normal vehicle at R2-D2-boosted capacity (2 pilots) is not eligible for a third", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.units.jtl.r2d2, 1),
        GameStateBuilder.Upgrade(Cards.units.jtl.snapWexley, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(0);
  });

  it("Millennium Falcon with R2-D2 has effective max of 3 — eligible for two more pilots", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.units.jtl.r2d2, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(1);
  });

  it("Millennium Falcon with R2-D2 and two other pilots is full", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.shd.cadBane)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.units.jtl.r2d2, 1),
        GameStateBuilder.Upgrade(Cards.units.jtl.lukeSkywalker, 1),
        GameStateBuilder.Upgrade(Cards.units.jtl.snapWexley, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(0);
  });

  // Poe Dameron (JTL_013) has the Pilot trait. He ATTACHES via his leader ability rather than
  // being played or deployed, but once attached he is a Pilot on that Vehicle — so he fills its
  // Pilot slot. (The Falcon's "+1/+0 for each Pilot on it" already counted him; the slot rule
  // used to disagree, because it only recognised pilots by piloting cost / deploy threshold.)
  it("Poe Dameron attached via his leader ability DOES count toward the PILOT limit", () => {
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.blue30HP)
      .MyLeader(Cards.leaders.jtl.poeDameron)
      .TheirBase(Cards.bases.common.red30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.leaders.jtl.poeDameron, 1),
      ])
      .Build();

    const eligible = PilotingEligibleVehicles(state, 1);

    expect(eligible).toHaveLength(0); // the Hammerhead's only Pilot slot is taken by Poe
  });
});

describe("Piloting — play routing", () => {
  // Luke (JTL_094): cost=2, aspects=Command+Heroism, pilotingCost=3.
  // Snap Wexley (JTL_098): cost=3, aspects=Command+Heroism, pilotingCost=2.
  // With Cad Bane (Cunning+Villainy) + blue30HP (Vigilance): neither Command nor Heroism is covered.
  // Aspect penalty = 4 for both Luke and Snap Wexley.
  // Luke: fullCost=6, pilotCost=7 (piloting is MORE expensive — won't go to pilot-only path).
  // Snap Wexley: fullCost=7, pilotCost=6 (pilot is cheaper — good for pilot-only test).

  it("plays as unit normally when no vehicles are present", async () => {
    // Luke fullCost=6, 10 resources, no vehicles → pays unit cost, enters ground arena
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.lukeSkywalker)
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);

    // No PilotingOptionPending — Luke enters the arena directly (Luke is a Ground unit)
    expect(adapter.state.player1.groundArena.some(u => u.cardId === Cards.units.jtl.lukeSkywalker)).toBe(true);
  });

  it("shows piloting-option prompt when both unit and pilot costs are affordable and vehicle is present", async () => {
    // Snap Wexley: fullCost=7, pilotCost=6. 10 resources ≥ both → prompt for choice
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.snapWexley)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);

    expect(adapter.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    expect(adapter.state.player1.hand).toHaveLength(0);
  });

  it("goes directly to vehicle target when only piloting cost is affordable", async () => {
    // Snap Wexley: pilotCost=6, fullCost=7. 6 resources = pilotCost < fullCost → skip prompt, Target
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 6)
        .WithCardInHandForPlayer(1, Cards.units.jtl.snapWexley)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);

    // Directly to target selection (no option prompt)
    expect(adapter.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    expect(adapter.state.player1.hand).toHaveLength(0);
  });

  it("R2-D2 (PilotingCost = 0) goes directly to vehicle target when unit cost is unaffordable", async () => {
    // R2-D2 (JTL_245): aspect=Heroism; Cad Bane=Cunning+Villainy, blue30HP=Vigilance.
    // Heroism uncovered → penalty=2. fullCost=4+2=6, pilotCost=0+2=2.
    // 2 resources = pilotCost (2) < fullCost (6) → only piloting → Target
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 2)
        .WithCardInHandForPlayer(1, Cards.units.jtl.r2d2)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);

    expect(adapter.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target");
    expect(adapter.state.player1.hand).toHaveLength(0);
  });

  it("R2-D2 is not playable when no vehicles are present and cannot afford unit cost", async () => {
    // 0 resources: cannot afford pilotCost (2) and no vehicles → invalid
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .WithCardInHandForPlayer(1, Cards.units.jtl.r2d2)
        // No vehicles, no resources
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);

    expect(adapter.lastDispatchResponse?.invalidAction).toBe(true);
  });
});

describe("Piloting — play as pilot", () => {
  // Luke (JTL_094): unitCost=2, pilotingCost=3, aspects=Command+Heroism.
  // With Cad Bane (Cunning+Villainy) + blue30HP (Vigilance): neither aspect covered → penalty=4.
  // Luke fullCost=6, pilotCost=7.
  // Both affordable requires ≥7 resources.
  //
  // Snap Wexley (JTL_098): unitCost=3, pilotingCost=2, aspects=Command+Heroism.
  // With Cad Bane + blue30HP: penalty=4. fullCost=7, pilotCost=6.
  // "Only pilot affordable" = 6 resources (pilotCost=6 < fullCost=7).

  it("attaches pilot to vehicle when 'Play as Pilot' is chosen", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.lukeSkywalker)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);
    await adapter.chooseOptionAsync(1, "Play as Pilot");
    await adapter.chooseSpaceUnitAsync(1, 0);

    const hammerhead = adapter.state.player1.spaceArena[0];
    expect(hammerhead.upgrades.some(u => u.cardId === Cards.units.jtl.lukeSkywalker)).toBe(true);
    expect(adapter.state.player1.spaceArena.some(u => u.cardId === Cards.units.jtl.lukeSkywalker)).toBe(false);
  });

  it("plays as unit when 'Play as Unit' is chosen", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.lukeSkywalker)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);
    await adapter.chooseOptionAsync(1, "Play as Unit");

    expect(adapter.state.player1.groundArena.some(u => u.cardId === Cards.units.jtl.lukeSkywalker)).toBe(true);
    expect(adapter.state.player1.spaceArena[0].upgrades).toHaveLength(0);
  });

  it("goes directly to vehicle target when only piloting is affordable, and attaches", async () => {
    // Snap Wexley: pilotCost=6, fullCost=7. 6 resources = pilotCost < fullCost → skip prompt, Target
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 6)
        .WithCardInHandForPlayer(1, Cards.units.jtl.snapWexley)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);
    await adapter.chooseSpaceUnitAsync(1, 0);

    const hammerhead = adapter.state.player1.spaceArena[0];
    expect(hammerhead.upgrades.some(u => u.cardId === Cards.units.jtl.snapWexley)).toBe(true);
  });

  it("Millennium Falcon accepts a second pilot after already carrying one", async () => {
    // Luke fullCost=6, pilotCost=7 with Cad Bane. 10 resources → both affordable → option prompt shown.
    // After choosing pilot, attaches as second upgrade.
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.shd.cadBane)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.lukeSkywalker)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.millenniumFalcon)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.units.jtl.snapWexley, 1),
        ])
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);
    expect(adapter.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await adapter.chooseOptionAsync(1, "Play as Pilot");
    await adapter.chooseSpaceUnitAsync(1, 0);

    const falcon = adapter.state.player1.spaceArena[0];
    expect(falcon.upgrades).toHaveLength(2);
    expect(falcon.upgrades.some(u => u.cardId === Cards.units.jtl.lukeSkywalker)).toBe(true);
  });

  it("vehicle carrying Poe (attached via his ability) can NOT take another pilot", async () => {
    // Poe Dameron leader (Aggression+Heroism) + blue30HP (Vigilance): Luke's Command uncovered → penalty=2.
    // Luke fullCost=4, pilotCost=5. 10 resources → both affordable, but Poe already fills the
    // Hammerhead's only Pilot slot, so "Play as Pilot" has no legal target and Luke is played
    // as a unit instead.
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.poeDameron)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
        .WithCardInHandForPlayer(1, Cards.units.jtl.lukeSkywalker)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .WithUpgradesOnSpaceUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.leaders.jtl.poeDameron, 1),
        ])
        .Build(),
    );

    await adapter.playCardFromHandAsync(1, 0);

    const hammerhead = adapter.state.player1.spaceArena[0];
    expect(hammerhead.upgrades.map(u => u.cardId)).toEqual([Cards.leaders.jtl.poeDameron]);
    expect(adapter.state.player1.groundArena.some(u => u.cardId === Cards.units.jtl.lukeSkywalker)).toBe(true);
  });
});

describe("Piloting — leader deploy", () => {
  it("deploys non-pilot leader as unit normally when no PilotingCost", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.sor.darthVader)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.shd.cadBane)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 10)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.deployLeaderAsync(1);

    expect(adapter.state.player1.leader.deployed).toBe(true);
    expect(adapter.state.player1.groundArena.some(u => u.cardId === Cards.leaders.sor.darthVader)).toBe(true);
  });
});

describe("Piloting — Asajj Ventress leader pilot deploy", () => {
  it("shows deploy-as-unit or deploy-as-pilot prompt when Asajj has 6 resources and a vehicle is present", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.asajjVentress)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 6)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.deployLeaderAsync(1);

    const resolution = adapter.lastDispatchResponse?.resolutionNeeded;
    expect(resolution?.type).toBe("Option");
    expect((resolution as import("@/lib/engine/message-types").NeedsOption)?.options).toContain("Deploy as Pilot");
    expect(adapter.state.player1.leader.epicActionUsed).toBe(true);
  });

  it("deploys Asajj normally as a unit when no vehicles are present", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.asajjVentress)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 6)
        .Build(),
    );

    await adapter.deployLeaderAsync(1);

    expect(adapter.state.player1.leader.deployed).toBe(true);
    expect(adapter.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.asajjVentress)).toBe(true);
  });

  it("Asajj deploys as a pilot upgrade on a vehicle when 'Deploy as Pilot' is chosen", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.asajjVentress)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 6)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.deployLeaderAsync(1);
    await adapter.chooseOptionAsync(1, "Deploy as Pilot");
    await adapter.chooseSpaceUnitAsync(1, 0);

    const hammerhead = adapter.state.player1.spaceArena[0];
    expect(hammerhead.upgrades.some(u => u.cardId === Cards.leaders.jtl.asajjVentress)).toBe(true);
    expect(adapter.state.player1.leader.deployed).toBe(true);
    expect(adapter.state.player1.leader.deployedPlayId).toBeDefined();
  });

  it("Asajj deploys as a unit when 'Deploy as Unit' is chosen (even when vehicle is present)", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.asajjVentress)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 6)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    await adapter.deployLeaderAsync(1);
    await adapter.chooseOptionAsync(1, "Deploy as Unit");

    expect(adapter.state.player1.leader.deployed).toBe(true);
    expect(adapter.state.player1.groundArena.some(u => u.cardId === Cards.leaders.jtl.asajjVentress)).toBe(true);
    expect(adapter.state.player1.spaceArena[0].upgrades).toHaveLength(0);
  });

  it("cannot deploy Asajj when fewer than 6 resources are available", async () => {
    const adapter = new GameTestAdapter();
    adapter.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.blue30HP)
        .MyLeader(Cards.leaders.jtl.asajjVentress)
        .TheirBase(Cards.bases.common.red30HP)
        .TheirLeader(Cards.leaders.sor.darthVader)
        .FillResourcesForPlayer(1, Cards.bases.common.blue30HP, 5)
        .Build(),
    );

    await adapter.deployLeaderAsync(1);

    expect(adapter.lastDispatchResponse?.invalidAction).toBe(true);
    expect(adapter.state.player1.leader.deployed).toBe(false);
  });
});
