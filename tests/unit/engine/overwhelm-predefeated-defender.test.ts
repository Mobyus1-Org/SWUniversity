import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// Comprehensive Rules 11 + Overwhelm: "If a unit is defeated prior to being dealt combat damage
// by an attacker with Overwhelm, all combat damage that would have been dealt is considered excess
// damage." So when an On Attack ability defeats the defender before combat, an Overwhelm attacker
// spills its ENTIRE attacking power to the opponent's base.
describe("Overwhelm — defender defeated before combat damage", () => {
  it("spills the attacker's full power to base when its On Attack ability defeats the defender", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      // Clan Challengers: base 3/6, Raid 3, gains Overwhelm while upgraded.
      .WithGroundUnitForPlayer(1, Cards.units.shd.clanChallengers)
      // Vambrace Flamethrower makes it upgraded (→ Overwhelm), grants +1/+1, and the 3-damage On
      // Attack. Attacking power = 3 (base) + 1 (Vambrace) + 3 (Raid) = 7.
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.vambraceFlamethrower, 1),
      ])
      // Defender: Battlefield Marine (3/3). The Flamethrower's 3 damage defeats it before combat.
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);         // attack the Marine
    await g.chooseYesAsync(1);                    // use the Flamethrower
    await g.spreadDamageAsync(1, [[2, "Ground", 0, 3]]); // all 3 onto the Marine → defeated

    expect(g.state.player2.groundArena).toHaveLength(0); // defender gone before combat
    // Defender was defeated pre-combat, so all of Clan Challengers' 7 attacking power is excess.
    expect(g.state.player2.base.damage).toBe(7);
  });

  it("spills nothing when the attacker lacks Overwhelm", async () => {
    const g = new GameTestAdapter();
    const state = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.shd.boKatanKryze)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.darthVader)
      // Sundari Peacekeeper: no Overwhelm, but carries the Flamethrower for the pre-combat defeat.
      .WithGroundUnitForPlayer(1, Cards.units.shd.sundariPeaceKeeper)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [
        GameStateBuilder.Upgrade(Cards.upgrades.shd.vambraceFlamethrower, 1),
      ])
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
      .Build();
    g.loadNewState(state);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);
    await g.chooseYesAsync(1);
    await g.spreadDamageAsync(1, [[2, "Ground", 0, 3]]);

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0); // no Overwhelm → excess is lost, not spilled
  });
});
