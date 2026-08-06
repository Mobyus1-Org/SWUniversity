import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasHidden } from "@/server/engine/card-db/keyword-dictionaries.ts/hidden";
import { NeedsTarget } from "@/lib/engine/message-types";

// SEC_238 Sith Assassin (3/2 Ground, 2 cost, Villainy) —
//   "Hidden (This unit can't be attacked if it was played this phase.)"
describe("SEC_238 Sith Assassin", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren);
  }

  it("has Hidden", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, Cards.units.sec.sithAssassin).Build());

    const assassin = g.state.player1.groundArena[0];
    expect(HasHidden(assassin.cardId, assassin.playId, 1)).toBe(true);
  });

  it("can't be attacked the phase it was played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.units.sec.sithAssassin)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // the only legal target
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // attacker
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.attackWithGroundUnitAsync(2, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds!.length).toBe(1);
    const hiddenPlayId = g.state.player1.groundArena.find(u => u.cardId === Cards.units.sec.sithAssassin)!.playId;
    expect(target.fromPlayIds).not.toContain(hiddenPlayId);
  });

  it("control: a non-Hidden unit played the same phase IS attackable", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
        .WithCardInHandForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.attackWithGroundUnitAsync(2, 0);

    // Both friendly ground units are legal targets — nothing was hidden.
    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds!.length).toBe(2);
  });
});
