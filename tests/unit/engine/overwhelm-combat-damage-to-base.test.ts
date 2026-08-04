import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// CR 8.7.d — "When an attacker with Overwhelm deals excess damage to a base, it is considered to
// have dealt COMBAT DAMAGE to the base, but it is not considered to have ATTACKED that base."
//
// The engine had this backwards: every "dealt combat damage to a base" trigger lived inline in the
// base-attack branch only, so an Overwhelm kill that spilled onto the base fired none of them.
// These are the five cards that were silently dead on that path.
describe("Overwhelm excess counts as combat damage to a base (CR 8.7.d)", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithActivePlayer(1);
  }

  // Darth Malak: 4 power with printed Overwhelm. Into a 1/1 Battle Droid that leaves 3 excess.
  const malakOverDroid = () =>
    base()
      .WithGroundUnitForPlayer(1, Cards.units.lof.darthMalak)
      .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid);

  it("ASH_144 Vane's Snub Fighter gets its Advantage token from a spill", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(malakOverDroid().WithSpaceUnitForPlayer(1, Cards.units.ash.vanesSnubFighter).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(3);
    const vanes = g.state.player1.spaceArena[0];
    expect(vanes.upgrades.filter(u => u.cardId === Cards.upgrades.token.advantage)).toHaveLength(1);
  });

  it("control: no spill, no Advantage token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthMalak)
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // 10 HP — nothing spills
        .WithSpaceUnitForPlayer(1, Cards.units.ash.vanesSnubFighter)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(0);
    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(0);
  });

  it("ASH_183 Whistling Birds fires off a spill", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      malakOverDroid()
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(Cards.upgrades.ash.whistlingBirds, 1),
        ])
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // bystander, 4/10
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    // The droid died to combat; the surviving enemy ground unit takes Whistling Birds' 2.
    const survivor = g.state.player2.groundArena.find(u => u.cardId === Cards.units.lof.hyperspaceWayfarer)!;
    expect(survivor.damage).toBe(2);
  });

  it("SHD_147 Ketsu Onyo is offered her ability off a spill", async () => {
    // Ketsu costs 2, so a deployed Moff Gideon grants her Overwhelm while attacking a unit.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.shd.moffGideon, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.shd.moffGideon)
        .WithGroundUnitForPlayer(1, Cards.units.shd.ketsuOnyo) // 3/2
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1/1 → excess spills
        // The upgrade must sit on a unit that SURVIVES: the droid is defeated by the combat
        // damage, taking its upgrades with it, so there would be nothing left to defeat.
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .WithUpgradesOnGroundUnitForPlayer(2, 1, [
          GameStateBuilder.Upgrade(Cards.upgrades.token.experience, 2),
        ])
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 1); // Ketsu
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBeGreaterThan(0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("SOR_133 Seventh Sister is offered her ability off a spill", async () => {
    // Maul's deployed leader unit grants Overwhelm to every other friendly unit.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.twi.maul, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.twi.maul)
        .WithGroundUnitForPlayer(1, Cards.units.sor.seventhSister) // 3/6
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1/1 → 2 excess
        // Her ability needs a surviving enemy ground unit to point at — the droid is defeated.
        .WithGroundUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 1); // Seventh Sister
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(2);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
  });

  it("JTL_177 Stay on Target draws off a spill", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.twi.maul, true, true)
        .WithGroundUnitForPlayer(1, Cards.leaders.twi.maul)
        .WithSpaceUnitForPlayer(1, Cards.units.jtl.phoenixSquadronAWing) // a Vehicle
        .WithSpaceUnitForPlayer(2, Cards.units.token.tieFighter) // 1/1
        .WithCardInHandForPlayer(1, Cards.events.jtl.stayOnTarget)
        .WithCardInDeckForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    const handBefore = g.state.player1.hand.length;
    await g.playCardFromHandAsync(1, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // Event left hand (-1), Stay on Target's draw put one back (+1).
    expect(g.state.player1.hand.length).toBe(handBefore);
    expect(g.state.player2.base.damage).toBeGreaterThan(0);
  });
});
