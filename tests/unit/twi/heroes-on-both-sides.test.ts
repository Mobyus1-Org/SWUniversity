import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, pick } = F;
const CLONE = Cards.units.token.cloneTrooper;   // 2/2 Republic Clone Trooper token
const DROID = Cards.units.token.battleDroid;    // 1/1 Separatist Droid token
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// TWI_249 Heroes on Both Sides (Event): "Choose up to 1 Republic unit and up to 1 Separatist unit. Give each chosen unit +2/+2 and Saboteur for this phase."
describe("TWI_249 Heroes on Both Sides", () => {
  it("+2/+2 and Saboteur on a Republic and a Separatist unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CLONE).WithGroundUnitForPlayer(2, DROID).WithCardInHandForPlayer(1, Cards.events.twi.heroesOnBothSides).Build());
    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    await g.chooseYesAsync(1);
    await pick(g, [g.state.player2.groundArena[0].playId]);
    expect(F.power(g.state.player1.groundArena[0])).toBe(4);
    expect(F.power(g.state.player2.groundArena[0])).toBe(3);
    expect(HasSaboteur(CLONE, g.state.player1.groundArena[0].playId, 1)).toBe(true);
  });
});
