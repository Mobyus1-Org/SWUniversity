import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";

// SOR_156 Benthic 'Two Tubes' — Partisan Lieutenant (2/2 Ground, cost 1, Aggression)
//   "On Attack: Another friendly [Aggression] unit gains Raid 2 for this phase."
//
// Mandatory, and never Benthic himself. A non-Aggression friendly unit is not offered.

const BENTHIC = Cards.units.sor.benthicTwoTubes;
const WOLFFE = Cards.units.sor.wolffe;            // Aggression
const MARINE = Cards.units.sor.battlefieldMarine; // Command/Heroism — not Aggression

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.idenVersio)
    .WithGroundUnitForPlayer(1, BENTHIC)
    .WithActivePlayer(1);
}

describe("SOR_156 Benthic 'Two Tubes'", () => {
  it("On Attack: another friendly Aggression unit gains Raid 2 for this phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, WOLFFE).Build());
    const wolffe = g.state.player1.groundArena[1].playId;
    const before = RaidAmount(WOLFFE, wolffe, 1);

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [wolffe] });

    expect(RaidAmount(WOLFFE, wolffe, 1)).toBe(before + 2);
    expect(g.state.player2.base.damage).toBe(2); // Benthic's own attack is unaffected
  });

  it("offers no non-Aggression unit — with only a Marine beside him, nothing is asked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(1, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
