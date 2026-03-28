import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../../card-helpers";
import { Unit } from "@/server/engine/unit";

describe("Leader Unit Ability", () => {
  it("should get +1 power from self Director Krennic passive ability when damaged", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.directorKrennic, true, 1)
      .Build()
    ;
    g.loadNewState(s);
    // act
    const res = Unit.FromInterface(g.state.player1.groundArena[0]);
    // assert
    expect(res.CurrentPower()).toBe(3);
    expect(res.CurrentHP()).toBe(6);
  });

  it("should get +1 power from Director Krennic passive ability when damaged", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.directorKrennic)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft, true, 1)
      .Build()
    ;
    g.loadNewState(s);
    // act
    const res = Unit.FromInterface(g.state.player1.spaceArena[0]);
    const krennic = Unit.FromInterface(g.state.player1.groundArena[0]);
    // assert
    expect(krennic.CurrentPower()).toBe(2);
    expect(krennic.CurrentHP()).toBe(7);
    expect(res.CurrentPower()).toBe(4);
    expect(res.CurrentHP()).toBe(3);
  });

  it("should not get +1 power from Director Krennic passive ability when not damaged", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.sor.directorKrennic, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.leaders.sor.directorKrennic)
      .WithSpaceUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)
      .Build()
    ;
    g.loadNewState(s);
    // act
    const res = Unit.FromInterface(g.state.player1.spaceArena[0]);
    const krennic = Unit.FromInterface(g.state.player1.groundArena[0]);
    // assert
    expect(krennic.CurrentPower()).toBe(2);
    expect(krennic.CurrentHP()).toBe(7);
    expect(res.CurrentPower()).toBe(3);
    expect(res.CurrentHP()).toBe(4);
  });

  it("should get +1 power from Boba Fett - Daimyo passive ability", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.shd.bobaFett, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.bobaFett)
      .Build()
    ;
    g.loadNewState(s);
    // act
    const res = Unit.FromInterface(g.state.player1.groundArena[0]);
    // assert
    expect(res.CurrentPower()).toBe(5);
    expect(res.CurrentHP()).toBe(4);
  });

  it("should not get +1 power from self Boba Fett - Daimyo passive ability", async () => {
    // arrange
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.red30HP)
      .MyLeader(Cards.leaders.shd.bobaFett, undefined, true, true)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)
      .WithGroundUnitForPlayer(1, Cards.leaders.shd.bobaFett)
      .WithUpgradesOnGroundUnitForPlayer(1, 1, [
        GameStateBuilder.Upgrade(Cards.upgrades.sor.protector, 1)
      ])
      .Build()
    ;
    g.loadNewState(s);
    // act
    const res = Unit.FromInterface(g.state.player1.groundArena[0]);
    const boba = Unit.FromInterface(g.state.player1.groundArena[1]);
    // assert
    expect(res.CurrentPower()).toBe(5);
    expect(res.CurrentHP()).toBe(4);
    expect(boba.CurrentPower()).toBe(5);
    expect(boba.CurrentHP()).toBe(8);
  });
});