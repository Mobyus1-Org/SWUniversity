import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { Cards } from "../../card-helpers";

// SEC_152 Strike Force X-Wing (3/2 Space) —
//   "When Played: You may deal 2 damage to a ready unit."
//   "Plot"
function setup() {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.sec.strikeForceXWing)
      // Ready 3/7 — survives the 2 damage so it is observable.
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, true)
      // Exhausted 3/7 — must not be offered as a target.
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce, false)
      .Build(),
  );
  return g;
}

describe("SEC_152 Strike Force X-Wing", () => {
  it("has Plot", () => {
    setup();
    expect(HasKeyword(Cards.units.sec.strikeForceXWing, "Plot")).toBe(true);
  });

  it("deals 2 damage to the chosen ready unit", async () => {
    const g = setup();

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  // "a ready unit" — the exhausted unit must not be a legal choice.
  it("does not offer an exhausted unit as a target", async () => {
    const g = setup();

    await g.playCardFromHandAsync(1, 0);
    const res = await g.chooseYesAsync(1);

    const readyPlayId = g.state.player2.groundArena[0].playId;
    const exhaustedPlayId = g.state.player2.groundArena[1].playId;
    const resolution = res.lastDispatchResponse?.resolutionNeeded;
    const offered = resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];

    expect(offered).toContain(readyPlayId);
    expect(offered).not.toContain(exhaustedPlayId);
  });

  it("declining deals no damage", async () => {
    const g = setup();

    const played = await g.playCardFromHandAsync(1, 0);
    // Dispatching an option with no pending is a silent no-op, so prove the prompt exists.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    const res = await g.chooseNoAsync(1);

    expect(res.state.player2.groundArena[0].damage).toBe(0);
    expect(res.state.player2.groundArena[1].damage).toBe(0);
  });
});
