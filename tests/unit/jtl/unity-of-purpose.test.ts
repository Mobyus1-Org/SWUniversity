import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// JTL_106 Unity of Purpose — For each friendly unit with a different name,
// give each unit you control +1/+1 for this phase.
// Aspects: Command+Command (Moff Gideon covers 1 Command → 1 penalty → need 8 resources).

describe("JTL_106 Unity of Purpose", () => {
  it("buffs each friendly unit by +N/+N where N equals the number of distinct unit names", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.jtl.unityOfPurpose)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)    // name 1
        .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper)         // name 2
        .WithGroundUnitForPlayer(1, Cards.units.sor.systemPatrolCraft)    // name 3
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // 3 distinct names → 3 JTL_106 effects pushed
    const effects = g.state.currentEffects.filter(e => e.cardId === "JTL_106" && e.affectedPlayer === 1);
    expect(effects).toHaveLength(3);

    // Each friendly unit's power and HP should be +3
    const marine = g.state.player1.groundArena[0];
    const death = g.state.player1.groundArena[1];
    const patrol = g.state.player1.groundArena[2];

    expect(Unit.FromInterface(marine).CurrentPower()).toBe(3 + 3); // base 3 + 3 buffs
    expect(Unit.FromInterface(marine).TotalHP()).toBe(3 + 3);

    expect(Unit.FromInterface(death).CurrentPower()).toBe(3 + 3);
    expect(Unit.FromInterface(death).TotalHP()).toBe(3 + 3);

    expect(Unit.FromInterface(patrol).CurrentPower()).toBe(3 + 3); // base power 3
    expect(Unit.FromInterface(patrol).TotalHP()).toBe(4 + 3); // base HP 4
  });

  it("two units with the same name count as one distinct name", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.jtl.unityOfPurpose)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // name 1
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // same name — not a distinct second
        .WithGroundUnitForPlayer(1, Cards.units.sor.deathTrooper)      // name 2
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    // 2 distinct names → 2 JTL_106 effects pushed
    const effects = g.state.currentEffects.filter(e => e.cardId === "JTL_106" && e.affectedPlayer === 1);
    expect(effects).toHaveLength(2);

    const marine = g.state.player1.groundArena[0];
    expect(Unit.FromInterface(marine).CurrentPower()).toBe(3 + 2); // base 3 + 2 buffs
    expect(Unit.FromInterface(marine).TotalHP()).toBe(3 + 2);
  });

  it("does nothing when no friendly units are in play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.shd.moffGideon)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.events.jtl.unityOfPurpose)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const effects = g.state.currentEffects.filter(e => e.cardId === "JTL_106");
    expect(effects).toHaveLength(0);
  });
});
