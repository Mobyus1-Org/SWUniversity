import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
import { playCost } from "@/server/engine/card-playability";

// JTL_032 Director Krennic — On the Verge of Greatness (2/2): "Shielded" / "The first unit you play each round
// that has a 'When Defeated' ability costs 1 resource less."
const WD_UNIT = Cards.units.twi.battleDroidLegion; // has a When Defeated
describe("JTL_032 Director Krennic", () => {
  it("the first When Defeated unit each round costs 1 less", () => {
    const without = load(board().Build());
    const withKrennic = load(board().WithGroundUnitForPlayer(1, Cards.units.jtl.directorKrennicVerge).Build());
    expect(playCost(withKrennic.state, 1, WD_UNIT)).toBe(playCost(without.state, 1, WD_UNIT) - 1);
    expect(playCost(withKrennic.state, 1, MARINE)).toBe(playCost(without.state, 1, MARINE)); // no When Defeated
  });
  it("only the first: once one is played this round, no discount", () => {
    const state = board().WithGroundUnitForPlayer(1, Cards.units.jtl.directorKrennicVerge).Build();
    state.roundState.cardsPlayedThisRound.push({ fromPlayer: 1, cardId: WD_UNIT, playId: "900", playedAs: "Unit" });
    const without = load(board().Build());
    const g = load(state);
    expect(playCost(g.state, 1, WD_UNIT)).toBe(playCost(without.state, 1, WD_UNIT));
  });
});
