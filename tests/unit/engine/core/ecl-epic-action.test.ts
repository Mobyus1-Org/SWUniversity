import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { NeedsOption } from "@/lib/engine/message-types";

describe("ECL Epic Action", () => {
  it("test 1: happy path — plays a unit, Ambush fires, unit attacks enemy unit", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const enemyUnitPlayId = g.state.player2.groundArena[0].playId;

    // act
    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyUnitPlayId] });

    // assert — both 3/3 marines die in mutual combat
    expect(g.state.player2.groundArena.length).toBe(0);
  });

  it("test 2: Ambush prompt appears and resolves — prompt text is correct", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const enemyUnitPlayId = g.state.player2.groundArena[0].playId;

    // act
    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // assert Ambush prompt
    const resolution = g.lastDispatchResponse!.resolutionNeeded as NeedsOption;
    expect(resolution.type).toBe("Option");
    expect(resolution.helperText).toContain("Ambush — attack immediately?");

    // resolve
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyUnitPlayId] });

    // no more pending
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("test 3: choosing 'No' for Ambush — unit enters exhausted, no attack", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 2)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    // act
    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    // assert
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("test 4: Ambush scoped to ECL unit only — pre-existing unit gets no Ambush", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);
    const enemyUnitPlayId = g.state.player2.groundArena[0].playId;

    // act
    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // Check: Ambush prompt fires for battlefieldMarine (NOT for systemPatrolCraft)
    const resolution = g.lastDispatchResponse!.resolutionNeeded as NeedsOption;
    expect(resolution.helperText).toContain("Battlefield Marine");

    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [enemyUnitPlayId] });

    // assert — space unit untouched; only one Ambush fired (no second prompt)
    expect(g.state.player1.spaceArena.length).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("test 5: empty hand — soft pass (epic action consumed, no resolution)", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .Build();
    g.loadNewState(state);

    // act
    await g.useBaseAbilityAsync(1);

    // assert
    expect(g.state.player1.base.epicActionUsed).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
  });

  it("test 6: only unit costs > 6 — soft pass (epic action consumed, no resolution)", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 7)
      .WithCardInHandForPlayer(1, "SOR_087")
      .Build();
    g.loadNewState(state);

    // act
    await g.useBaseAbilityAsync(1);

    // assert
    expect(g.state.player1.base.epicActionUsed).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
  });

  it("test 7: not enough resources — soft pass (epic action consumed, no resolution)", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 3)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    // act
    await g.useBaseAbilityAsync(1);

    // assert
    expect(g.state.player1.base.epicActionUsed).toBe(true);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.lastDispatchResponse?.invalidAction).toBeFalsy();
  });

  it("test 8: epic action already used — rejection", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab, 0, true)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build();
    g.loadNewState(state);

    // act
    await g.useBaseAbilityAsync(1);

    // assert
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("test 9: piloting unit played via ECL — enters as unit (no Piloting prompt), gets Ambush", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.jtl.r2d2)
      .Build();
    g.loadNewState(state);

    // act
    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // r2d2 is now in groundArena, Ambush trigger fires (not a piloting-option)
    const resolution = g.lastDispatchResponse!.resolutionNeeded as NeedsOption;

    // assert
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.jtl.r2d2)).toBe(true);
    expect(resolution.type).toBe("Option");
    expect(resolution.helperText).not.toContain("pilot upgrade");
    expect(resolution.helperText).toContain("Ambush — attack immediately?");
  });

  it("test 10: ECL unit has When Played — trigger-order prompt appears", async () => {
    // arrange
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.sor.energyConversionLab)
      .MyLeader(Cards.leaders.sor.heraSyndulla)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(1, Cards.units.sor.brightHope)
      .Build();
    g.loadNewState(state);

    // act
    await g.useBaseAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);

    // assert — trigger-order prompt because both Ambush and When Played are in the bag
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    expect((g.lastDispatchResponse!.resolutionNeeded as NeedsOption).helperText).toBe(
      "Choose which trigger to resolve first:"
    );
  });
});
