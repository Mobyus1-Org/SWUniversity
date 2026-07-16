import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";

// SEC_221 Unruly Astromech (3/2 Ground) —
//   "Hidden (This unit can't be attacked if it was played this phase.)
//    When Defeated: Exhaust an enemy unit."
describe("SEC_221 Unruly Astromech", () => {
  it("has Hidden", () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.sec.unrulyAstromech)
        .Build(),
    );
    const astromech = g.state.player1.groundArena[0];
    expect(HasHidden(astromech.cardId, astromech.playId, 1)).toBe(true);
  });

  it("When Defeated: exhausts a chosen enemy unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, Cards.units.sec.unrulyAstromech) // 2 HP, dies to the Marine
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // attacker (index 0)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine, true) // ready bystander (index 1) — the exhaust target
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseGroundUnitAsync(1, 0); // attack the Astromech → it dies → When Defeated fires

    // The attacking Marine died to counter-damage; the surviving ready enemy is the exhaust target.
    const survivorIdx = g.state.player2.groundArena.findIndex(u => u.ready);
    // (If both remain, pick the ready one; drive the target explicitly.)
    await g.chooseGroundUnitAsync(2, survivorIdx === -1 ? 0 : survivorIdx);

    // Every enemy unit that remains is now exhausted.
    expect(g.state.player2.groundArena.every(u => !u.ready)).toBe(true);
  });
});
