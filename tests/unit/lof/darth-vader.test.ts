import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_037 Darth Vader (5/6 Ground, Force/Imperial/Sith, cost 6)
// "When Played: Give a Shield token to a friendly unit and to an enemy unit."
// "On Attack: Defeat an enemy unit with a Shield token on it."

function shields(unit: { upgrades: { cardId: string }[] }): number {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
}

function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
    .WithCardInHandForPlayer(1, Cards.units.lof.darthVader);
}

describe("LOF_037 Darth Vader", () => {
  it("When Played: gives a Shield token to a chosen friendly and a chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // friendly target
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy target
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseGroundUnitAsync(1, 0); // friendly Marine gets a Shield
    await g.chooseGroundUnitAsync(2, 0); // enemy Marine gets a Shield

    expect(shields(g.state.player1.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)!)).toBe(1);
    expect(shields(g.state.player2.groundArena[0])).toBe(1);
  });

  it("can shield Vader himself as the friendly target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine).Build());

    await g.playCardFromHandAsync(1, 0);
    const vader = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.darthVader)!;
    await g.chooseGroundUnitAsync(1, g.state.player1.groundArena.indexOf(vader)); // shield Vader
    await g.chooseGroundUnitAsync(2, 0);

    expect(shields(g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.darthVader)!)).toBe(1);
  });

  it("On Attack: defeats an enemy unit that has a Shield token, before combat", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthVader)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // the shielded unit + defender
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [
          { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2 as const, controller: 2 as const },
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Vader attacks the shielded Marine
    await g.chooseGroundUnitAsync(2, 0); // On Attack: defeat the shielded Marine

    // Defeated before combat, so Vader takes no counter-damage.
    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("On Attack can defeat a shielded unit that is NOT the one being attacked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthVader)
        // A tanky non-Sentinel attack target that survives Vader's 5 (so combat is observable).
        .WithGroundUnitForPlayer(2, Cards.units.sor.emperorPalpatine)   // index 0 — the attack target, no shield
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // index 1 — the shielded bystander
        .WithUpgradesOnGroundUnitForPlayer(2, 1, [
          { cardId: Cards.upgrades.token.shield, playId: "@", owner: 2 as const, controller: 2 as const },
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0); // Vader attacks Palpatine (unshielded)
    await g.chooseGroundUnitAsync(2, 1); // On Attack: defeat the shielded Marine instead

    expect(g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBeUndefined();
    // The attacked unit still fought Vader in combat.
    const palpatine = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.emperorPalpatine);
    expect(palpatine).toBeDefined();
    expect(palpatine!.damage).toBe(5); // Vader's 5 power
  });

  it("On Attack does nothing when no enemy unit has a Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthVader)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    const res = await g.chooseGroundUnitAsync(2, 0); // attack the Marine, no On Attack prompt

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeUndefined();
    expect(g.state.player2.groundArena).toHaveLength(0); // 5 power defeated the 3-HP Marine in combat
    expect(g.state.player1.groundArena[0].damage).toBe(3); // Vader took the Marine's counter-damage
  });
});
