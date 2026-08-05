import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";

// LOF_025 Temple of Destruction (Base, Aggression, 25 HP) —
//   "When a friendly unit deals 3 or more combat damage to an enemy base:
//    The Force is with you (create your Force token)."
//
// Unlike the eight common Force bases, this triggers on COMBAT DAMAGE LANDING, not on a Force unit
// declaring an attack. Per CR 7.5.7.d that includes Overwhelm excess: "When an attacker with
// Overwhelm deals excess damage to a base, it is considered to have dealt combat damage to the
// base, but it is not considered to have attacked that base." The attacked/not-attacked
// distinction is about the attack, not about the damage type.
describe("LOF_025 Temple of Destruction", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.lof.templeOfDestruction)
      .MyLeader(Cards.leaders.sor.darthVader)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithActivePlayer(1);
  }

  const force = (g: GameTestAdapter) => g.state.player1.supplemental.forceToken;

  it("a direct base attack for exactly 3 creates the Force token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build()); // 3 power

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(force(g)).toBe(true);
  });

  it("control: a base attack for 2 does not", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.token.cloneTrooper).Build()); // 2/2

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(2);
    expect(force(g)).toBeFalsy();
  });

  it("CR 7.5.7.d: Overwhelm excess of 3 IS combat damage to the base — token created", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthMalak) // 4 power, Overwhelm
        .WithGroundUnitForPlayer(2, Cards.units.token.battleDroid) // 1/1 → 3 excess
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(3); // the spill
    expect(force(g)).toBe(true);
  });

  it("control: Overwhelm excess of 1 is below the threshold", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.lof.darthMalak) // 4 power
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 HP → 1 excess
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.base.damage).toBe(1);
    expect(force(g)).toBeFalsy();
  });

  it("does not fire on ABILITY damage to a base — that is not combat damage (CR 6.3 General c)", async () => {
    // K-2SO (4/4, Overwhelm) swings into a Wampa (4/5): the Wampa survives, so there is no excess
    // and no combat damage reaches a base. The counter-damage then defeats K-2SO, whose When
    // Defeated deals 3 to the enemy base — ability damage, which must NOT wake the Temple.
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, Cards.units.sor.k2so)
      .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
      .Build();
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [s.player2.groundArena[0].playId] });
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // the choice is real
    await g.dispatchAsync(1, "choose-option", { option: "deal_base_damage=2,3" });

    expect(g.state.player2.base.damage).toBe(3); // 3 landed on the base...
    expect(force(g)).toBeFalsy();                // ...but not as combat damage
  });

  it("only the Temple's controller benefits — an enemy unit hitting MY base gives me nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(g.state.player1.base.damage).toBe(3);
    expect(force(g)).toBeFalsy();
    expect(g.state.player2.supplemental.forceToken).toBeFalsy(); // P2's base isn't the Temple
  });

  it("control: the same attack with an ordinary base creates nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyBase(Cards.bases.common.red30HP) // not the Temple
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(force(g)).toBeFalsy();
  });

  it("already holding the Force token, a second trigger is a no-op", async () => {
    const g = new GameTestAdapter();
    const s = base().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build();
    s.player1.supplemental.forceToken = true;
    g.loadNewState(s);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(force(g)).toBe(true); // still exactly one — CreateForceToken ignores a duplicate
  });
});
