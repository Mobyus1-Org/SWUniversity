import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { Cards } from "../../card-helpers";

// LOF_149 Mace Windu — Leaping into Action (6/6 Ground) —
//   "Overwhelm"
//   "When Played: You may use the Force (lose your Force token). If you do, deal 4 damage to a unit."
function setup(withForce: boolean) {
  const g = new GameTestAdapter();
  g.loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14)
      .WithCardInHandForPlayer(1, Cards.units.lof.maceWinduLeaping)
      .WithGroundUnitForPlayer(2, Cards.units.sor.consularSecurityForce)
      .Build(),
  );
  g.state.player1.supplemental.forceToken = withForce;
  return g;
}

describe("LOF_149 Mace Windu — Leaping into Action", () => {
  it("has Overwhelm", () => {
    setup(true);
    expect(HasKeyword(Cards.units.lof.maceWinduLeaping, "Overwhelm")).toBe(true);
  });

  it("using the Force deals 4 damage to the chosen unit and spends the token", async () => {
    const g = setup(true);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseGroundUnitAsync(2, 0);

    const marine = g.state.player2.groundArena[0];
    expect(marine.damage).toBe(4);
    expect(g.state.player1.supplemental.forceToken).toBe(false);
  });

  it("declining deals no damage and keeps the Force token", async () => {
    const g = setup(true);

    const played = await g.playCardFromHandAsync(1, 0);
    // Dispatching an option with no pending is a silent no-op, so assert the prompt exists —
    // otherwise this test passes just as well against a card that was never implemented.
    expect(played.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");

    const res = await g.chooseNoAsync(1);

    expect(res.state.player2.groundArena[0].damage).toBe(0);
    expect(res.state.player1.supplemental.forceToken).toBe(true);
  });

  // No token means nothing to spend, so the ability must not prompt at all.
  it("does not prompt without a Force token", async () => {
    const g = setup(false);

    const res = await g.playCardFromHandAsync(1, 0);

    expect(res.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(res.state.player2.groundArena[0].damage).toBe(0);
  });
});
