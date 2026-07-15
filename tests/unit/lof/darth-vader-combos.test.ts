import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Combo coverage: Darth Vader (LOF_037) played via Timely Intervention (SHD_129) or Shien Flurry
// (LOF_220). Both give Vader Ambush; playing him triggers his When Played (shield a friendly + an
// enemy), and his Ambush attack triggers his On Attack (defeat a shielded enemy) before combat.

function shields(unit: { upgrades: { cardId: string }[] }): number {
  return unit.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield).length;
}

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("Darth Vader combos — Timely Intervention", () => {
  it("1) shield the lone enemy, then Ambush defeats it before combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.shd.timelyIntervention)
        .WithCardInHandForPlayer(1, Cards.units.lof.darthVader)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // the only enemy unit
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);                        // Timely Intervention
    await g.chooseCardFromHandAsync(1, 0);                      // play Vader
    await g.chooseOptionAsync(1, "Darth Vader — When Played");  // resolve When Played first
    await g.chooseGroundUnitAsync(1, 0);                        // shield Vader (friendly)
    await g.chooseGroundUnitAsync(2, 0);                        // shield the enemy Marine
    await g.chooseYesAsync(1);                                  // use Ambush
    await g.chooseGroundUnitAsync(2, 0);                        // attack the (shielded) Marine
    await g.chooseGroundUnitAsync(2, 0);                        // On Attack: defeat it

    expect(g.state.player2.groundArena).toHaveLength(0);       // defeated before combat
    expect(g.state.player1.groundArena[0].damage).toBe(0);     // Vader took no counter-damage
  });

  it("2) shield the enemy leader, Ambush the non-leader, On Attack defeats the leader", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.shd.timelyIntervention)
        .WithCardInHandForPlayer(1, Cards.units.lof.darthVader)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)  // [0] non-leader (attack target)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.grandMoffTarkin)  // [1] enemy leader unit
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Darth Vader — When Played");
    await g.chooseGroundUnitAsync(1, 0);   // shield Vader
    await g.chooseGroundUnitAsync(2, 1);   // shield the enemy leader
    await g.chooseYesAsync(1);             // Ambush
    await g.chooseGroundUnitAsync(2, 0);   // attack the non-leader Marine
    await g.chooseGroundUnitAsync(2, 1);   // On Attack: defeat the shielded leader instead

    // The leader was defeated (returned to leader zone) and the Marine fought Vader in combat.
    const vader = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.darthVader)!;
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.leaders.sor.grandMoffTarkin)).toBe(false);
    expect(g.state.player2.leader.deployed).toBe(false);
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.sor.battlefieldMarine)).toBe(false); // 5 power killed the 3-HP Marine
    // No Shien Flurry here, so the Marine's 3 counter-damage hits Vader's own Shield, which absorbs
    // it and is destroyed. (Contrast combo 4, where prevention zeroes the hit and the Shield lives.)
    expect(vader.damage).toBe(0);
    expect(shields(vader)).toBe(0);
  });
});

describe("Darth Vader combos — Shien Flurry", () => {
  it("3) shield the lone enemy, then Ambush defeats it before combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.lof.shienFlurry)
        .WithCardInHandForPlayer(1, Cards.units.lof.darthVader)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);                        // Shien Flurry
    await g.chooseCardFromHandAsync(1, 0);                      // play Vader (a Force unit)
    await g.chooseOptionAsync(1, "Darth Vader — When Played");
    await g.chooseGroundUnitAsync(1, 0);                        // shield Vader
    await g.chooseGroundUnitAsync(2, 0);                        // shield the enemy Marine
    await g.chooseYesAsync(1);                                  // Ambush
    await g.chooseGroundUnitAsync(2, 0);                        // attack the shielded Marine
    await g.chooseGroundUnitAsync(2, 0);                        // On Attack: defeat it

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.groundArena[0].damage).toBe(0);
  });

  it("4) shield the leader; Ambush into Gungi defeats the leader; Vader takes no damage so his Shield survives", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithCardInHandForPlayer(1, Cards.events.lof.shienFlurry)
        .WithCardInHandForPlayer(1, Cards.units.lof.darthVader)
        .WithGroundUnitForPlayer(2, Cards.units.lof.gungi)              // [0] non-leader, 2/5 (attack target)
        .WithGroundUnitForPlayer(2, Cards.leaders.sor.grandMoffTarkin) // [1] enemy leader unit
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Darth Vader — When Played");
    await g.chooseGroundUnitAsync(1, 0);   // shield Vader (friendly)
    await g.chooseGroundUnitAsync(2, 1);   // shield the enemy leader
    await g.chooseYesAsync(1);             // Ambush
    await g.chooseGroundUnitAsync(2, 0);   // attack Gungi
    await g.chooseGroundUnitAsync(2, 1);   // On Attack: defeat the shielded leader

    const vader = g.state.player1.groundArena.find(u => u.cardId === Cards.units.lof.darthVader)!;
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.leaders.sor.grandMoffTarkin)).toBe(false); // leader defeated
    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.lof.gungi)).toBe(false); // Gungi killed by Vader's 5
    expect(vader.damage).toBe(0);      // Gungi's 2 counter-damage was prevented (Shien Flurry)
    expect(shields(vader)).toBe(1);    // …so Vader's own Shield was NOT consumed
  });
});
