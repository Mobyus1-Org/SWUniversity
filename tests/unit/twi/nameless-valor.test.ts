import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token
import { UpgradeEligibleTargets } from "@/server/engine/card-db/upgrade-attach-restrictions";

// TWI_119 Nameless Valor (+2/+2): "Attach to a token unit." / "Attached unit gains Overwhelm."
describe("TWI_119 Nameless Valor", () => {
  it("only token units are eligible hosts", () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, CLONE).Build());
    expect(UpgradeEligibleTargets(Cards.upgrades.twi.namelessValor, g.state, 1)).toEqual([g.state.player1.groundArena[1].playId]);
  });
});
