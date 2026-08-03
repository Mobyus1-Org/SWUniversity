import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// SHD_130 Moment of Glory (Event, cost 3) — "Give a unit +4/+4 for this phase."
describe("SHD_130 Moment of Glory", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.leiaOrgana) // Command — no aspect penalty
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("gives a chosen friendly unit +4/+4 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // 3/3
        .WithCardInHandForPlayer(1, Cards.events.shd.momentOfGlory)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);

    const buffed = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(buffed.CurrentPower()).toBe(7); // 3 + 4
    expect(buffed.TotalHP()).toBe(7);      // 3 + 4
  });

  it("can target an enemy unit too ('a unit', not 'a friendly unit')", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithCardInHandForPlayer(1, Cards.events.shd.momentOfGlory)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(Unit.FromInterface(g.state.player2.groundArena[0]).CurrentPower()).toBe(7);
  });

  it("control: an unbuffed unit keeps its printed stats", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const plain = Unit.FromInterface(g.state.player1.groundArena[0]);
    expect(plain.CurrentPower()).toBe(3);
    expect(plain.TotalHP()).toBe(3);
  });
});
