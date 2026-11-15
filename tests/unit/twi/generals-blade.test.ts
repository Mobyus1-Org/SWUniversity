import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
import { playCost } from "@/server/engine/card-playability";

// TWI_121 General's Blade (+3/+3): "If attached unit is a Jedi, it gains: 'On Attack: The next unit you play this phase costs 2 resources less.'"
describe("TWI_121 General's Blade", () => {
  it("a Jedi host's attack makes the next unit cost 2 less", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.twi.ahsokaTanoUnit).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(Cards.upgrades.twi.generalsBlade, 1)]).Build());
    const before = playCost(g.state, 1, CSF);
    await F.attackBase(g);
    expect(playCost(g.state, 1, CSF)).toBe(before - 2);
  });
  it("a non-Jedi host gains nothing", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(Cards.upgrades.twi.generalsBlade, 1)]).Build());
    const before = playCost(g.state, 1, CSF);
    await F.attackBase(g);
    expect(playCost(g.state, 1, CSF)).toBe(before);
  });
});
