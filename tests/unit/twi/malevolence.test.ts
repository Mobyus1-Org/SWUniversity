import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick, CSF } = F;
import { CanUnitAttack } from "@/server/engine/core-functions";

// TWI_039 Malevolence (7/7 Space): "When Played: Give an enemy unit –4/–0 for this phase. It can't attack for this phase."
describe("TWI_039 Malevolence", () => {
  it("–4/–0 and it can't attack", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, Cards.units.twi.malevolence).Build());
    await F.playFromHand(g);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(F.power(g.state.player2.groundArena[0])).toBe(0);
    expect(CanUnitAttack(g.state.player2.groundArena[0])).toBe(false);
  });
});
