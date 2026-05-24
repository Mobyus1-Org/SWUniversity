import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

describe("SHD_012 Bo-Katan Kryze Leader", () => {
  it("deals 1 damage to a unit after a Mandalorian attacked this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP, 5)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper) // Mandalorian unit
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .Build();
    g.loadNewState(state);

    // Attack with the Mandalorian unit first
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Now use Bo-Katan's leader ability
    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player1.base.damage).toBe(3);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("soft-passes (no damage) when no Mandalorian attacked this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    // Use Bo-Katan without any Mandalorian having attacked
    await g.useLeaderAbilityAsync(1);

    // Leader should be exhausted but enemy unit untouched
    expect(g.state.player1.leader.ready).toBe(false);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("defeats a unit when the 1 damage brings it to 0 HP", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true, 2)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .Build();
    g.loadNewState(state);

    // Attack enemy base with the Mandalorian to register the attack without killing it
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Use Bo-Katan to finish the wounded BFM
    await g.useLeaderAbilityAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena).toHaveLength(0);
  });
});

describe("SHD_012 Bo-Katan Kryze Leader Unit (deployed)", () => {
  it("deals 1 damage when player accepts the first shot and no other Mandalorian attacked", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.boKatanKryze) // deployed leader in arena
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0); // Bo-Katan attacks
    await g.chooseBaseAsync(1, 2);           // target: enemy base
    await g.chooseYesAsync(1);              // accept first 1-damage shot
    await g.chooseGroundUnitAsync(2, 0);    // target: enemy BFM

    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.state.player2.base.damage).toBe(4); // Bo-Katan 4/7 hits base
  });

  it("skips damage when player declines the first shot", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.boKatanKryze)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1); // decline shot

    expect(g.state.player2.groundArena[0].damage).toBe(0);
    expect(g.state.player2.base.damage).toBe(4); // Bo-Katan 4/7 hits base
  });

  it("does NOT grant a second shot when Bo-Katan herself was the only Mandalorian who attacked", async () => {
    const g = new GameTestAdapter();
    const baseState = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.boKatanKryze)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();

    // Simulate Bo-Katan having attacked earlier this phase (e.g., was readied by an effect)
    const boKatan = baseState.player1.groundArena[0];
    baseState.roundState.unitsAttackedThisPhase.push({
      fromPlayer: 1,
      cardId: boKatan.cardId,
      playId: boKatan.playId,
    });
    g.loadNewState(baseState);

    // Bo-Katan attacks again (readied by prior effect)
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // Accept first shot, target enemy BFM
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // Second ping must NOT be offered — no other Mandalorian attacked, only Bo-Katan herself
    expect(g.state.player2.groundArena[0].damage).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
  });

  it("grants a second shot when another Mandalorian attacked this phase", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.boKatanKryze)
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper) // another Mandalorian
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
      .WithInitiativePlayerBeing(2)
      .WithInitiativeClaimed()
      .Build();
    g.loadNewState(state);

    // Sundari attacks first (registers as a Mandalorian attack)
    await g.attackWithGroundUnitAsync(1, 1);
    await g.chooseBaseAsync(1, 2);

    // Bo-Katan attacks
    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    // First shot: deal 1 to BFM
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // BFM

    // Second shot (another Mandalorian attacked): deal 1 to Gamorrean Guards
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 1); // Gamorrean Guards

    expect(g.state.player2.groundArena[0].damage).toBe(1); // BFM
    expect(g.state.player2.groundArena[1].damage).toBe(1); // Gamorrean Guards
  });
});
