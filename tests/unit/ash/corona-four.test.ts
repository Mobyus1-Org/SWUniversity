import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// ASH_043 Corona Four (2/3 Space) —
//   "On Attack: You may give a unit –2/–0 for this phase.
//    When Defeated: You may defeat a non-leader unit with 0 power."
describe("ASH_043 Corona Four", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1);
  }

  it("On Attack: may give a chosen unit -2/-0 for this phase (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.coronaFour)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing) // 2/2 target
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2); // Corona Four's own combat target
    await g.chooseYesAsync(1); // accept the -2/-0 offer
    await g.chooseSpaceUnitAsync(2, 0); // target the X-Wing

    const xwing = g.state.player2.spaceArena[0];
    expect(Unit.FromInterface(xwing).CurrentPower()).toBe(0); // 2 - 2
  });

  it("On Attack: may decline the debuff", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.ash.coronaFour)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseNoAsync(1);

    expect(Unit.FromInterface(g.state.player2.spaceArena[0]).CurrentPower()).toBe(2);
  });

  it("When Defeated: may defeat a non-leader unit with 0 power (accept)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.coronaFour) // 2/3, dies to 4-power attack
        .WithGroundUnitForPlayer(2, Cards.units.ash.emperorsMessenger) // 0 power (any arena)
        .WithSpaceUnitForPlayer(2, Cards.units.ash.gozantiAssaultCarrier) // 4 power attacker
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0); // attack Corona Four — 4 power kills its 3 HP outright

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.ash.coronaFour)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0); // defeat the 0-power Emperor's Messenger

    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.ash.emperorsMessenger)).toBe(false);
  });

  it("When Defeated: may decline; the 0-power unit is untouched", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.coronaFour)
        .WithGroundUnitForPlayer(2, Cards.units.ash.emperorsMessenger)
        .WithSpaceUnitForPlayer(2, Cards.units.ash.gozantiAssaultCarrier)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0);
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseNoAsync(1); // decline the defeat

    expect(g.state.player2.groundArena.some(u => u.cardId === Cards.units.ash.emperorsMessenger)).toBe(true);
  });

  it("When Defeated: no prompt when no non-leader unit has 0 power", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithActivePlayer(2)
        .WithSpaceUnitForPlayer(1, Cards.units.ash.coronaFour)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // 3 power, not 0
        .WithSpaceUnitForPlayer(2, Cards.units.ash.gozantiAssaultCarrier)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(2, 0); // Gozanti Assault Carrier is player2's only space unit
    await g.chooseSpaceUnitAsync(1, 0);

    expect(g.state.player1.spaceArena.some(u => u.cardId === Cards.units.ash.coronaFour)).toBe(false);
    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
  });
});
