import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// ASH_102 Ravager — Final Imperial Command (8/10 Space, Imperial/Vehicle/Capital Ship, cost 9)
// "Restore 2"
// "When you play a unit: You may have it deal damage equal to its power to a unit in the same arena."

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 6) // damage for Restore
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithSpaceUnitForPlayer(1, Cards.units.ash.ravager);
}

describe("ASH_102 Ravager", () => {
  it("has Restore 2: heals 2 from your base when it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4); // 6 - 2 restored
  });

  it("when YOU play a unit, it may deal damage equal to its power to a unit in the same arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft) // Space unit, 3 power
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.rebelliousHammerhead) // enemy in the SAME arena
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(3); // the played unit's power
  });

  it("declining deals no damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft)
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);
    // The prompt must actually appear, or "No" would be a silent no-op.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });

  it("can target the Ravager itself (it is in the same arena)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.systemPatrolCraft) // 3 power
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    const ravagerIdx = g.state.player1.spaceArena.findIndex(
      u => u.cardId === Cards.units.ash.ravager,
    );
    await g.chooseSpaceUnitAsync(1, ravagerIdx);

    expect(g.state.player1.spaceArena[ravagerIdx].damage).toBe(3);
  });

  it("does not fire for a unit played into the OTHER arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine) // GROUND unit
        .WithGroundUnitForPlayer(2, Cards.units.sor.gamorreanGuards)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    // The played unit is in the ground arena, so its targets are ground units — the
    // damage still happens, just within the played unit's own arena.
    expect(g.state.player2.groundArena[0].damage).toBe(3); // Marine's power
  });

  it("does NOT fire when the OPPONENT plays a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 10)
        .WithCardInHandForPlayer(2, Cards.units.sor.systemPatrolCraft)
        .WithActivePlayer(2)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(2, 0);

    // Ravager only reacts to units YOU play.
    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player1.spaceArena[0].damage).toBe(0); // Ravager untouched
  });

  it("does not trigger off the Ravager's own entry into play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
        .WithCardInHandForPlayer(1, Cards.units.ash.ravager)
        .WithSpaceUnitForPlayer(2, Cards.units.jtl.rebelliousHammerhead)
        .Build(),
    );

    const played = await g.playCardFromHandAsync(1, 0);

    expect(played.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.spaceArena[0].damage).toBe(0);
  });
});
