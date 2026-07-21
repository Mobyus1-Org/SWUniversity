import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_234 Masterstroke (Event, cost 2)
// "Attack with a unit. It gets +1/+0 for this attack for each unit the defending player controls
//  in its arena."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 16);
}

describe("ASH_234 Masterstroke", () => {
  it("gives +1/+0 per enemy unit in the attacker's arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.masterstroke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)     // 3 power
        .WithGroundUnitForPlayer(2, Cards.units.ash.mouseDroid)            // 3 enemy ground units
        .WithGroundUnitForPlayer(2, Cards.units.ash.mouseDroid)
        .WithGroundUnitForPlayer(2, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(6); // 3 base power + 3 enemy ground units
  });

  it("counts only the attacker's OWN arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.masterstroke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // ground attacker
        .WithGroundUnitForPlayer(2, Cards.units.ash.mouseDroid)        // 1 ground
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // space — must not count
        .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4); // 3 + 1 ground unit only
  });

  it("counts only the DEFENDING player's units, not your own", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.masterstroke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.ash.mouseDroid) // friendly — must not count
        .WithGroundUnitForPlayer(1, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3); // no enemy units at all
  });

  it("applies the bonus when attacking a unit too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.masterstroke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)     // 3 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce) // 3/7 defender
        .WithGroundUnitForPlayer(2, Cards.units.ash.mouseDroid)            // 2 enemy ground units total
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(5); // 3 + 2
  });

  it("is a plain attack when the defender controls nothing in that arena (control case)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.masterstroke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("does not leave the buff behind after the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.masterstroke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.ash.mouseDroid)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.currentEffects.filter(e => e.duration === "ForAttack")).toHaveLength(0);
  });

  it("does nothing when the caster has no ready unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.events.ash.masterstroke)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine, false)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player2.base.damage).toBe(0);
  });
});
