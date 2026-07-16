import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// LOF_158 Hyena Bomber (2/2 Space, cost 3) —
//   "When Played: If you control another Aggression unit, you may deal 2 damage to a ground unit."
describe("LOF_158 Hyena Bomber", () => {
  function build(withAggressionUnit: boolean) {
    const b = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.twi.countDooku)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // enemy ground target (3/3)
      .WithCardInHandForPlayer(1, Cards.units.lof.hyenaBomber);
    if (withAggressionUnit) {
      b.WithGroundUnitForPlayer(1, Cards.units.sor.fifthBrother); // Aggression unit
    }
    return b.Build();
  }

  it("deals 2 damage to a chosen ground unit when you control another Aggression unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(true));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // accept the optional damage
    await g.chooseGroundUnitAsync(2, 0); // enemy Battlefield Marine

    const marine = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);
    expect(marine?.damage).toBe(2);
  });

  it("may decline the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(true));

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // decline

    const marine = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);
    expect(marine?.damage).toBe(0);
  });

  it("control: no prompt and no damage when you control no other Aggression unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(build(false));

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    const marine = g.state.player2.groundArena.find(u => u.cardId === Cards.units.sor.battlefieldMarine);
    expect(marine?.damage).toBe(0);
  });
});
