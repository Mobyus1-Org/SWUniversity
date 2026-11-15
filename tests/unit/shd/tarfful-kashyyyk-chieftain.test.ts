import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, attackUnit, pick, MARINE, CSF } from "./scan-fixtures";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";

// SHD_250 Tarfful — Kashyyyk Chieftain (3/9 Ground): "Restore 2" / "When a friendly Wookiee unit is dealt
// combat damage and isn't defeated: That unit deals that much damage to an enemy ground unit."
describe("SHD_250 Tarfful", () => {
  it("has Restore 2", () => {
    expect(RestoreAmount(Cards.units.shd.tarfful)).toBe(2);
  });
  it("a surviving Wookiee deals the combat damage it took to an enemy ground unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, Cards.units.shd.tarfful).WithGroundUnitForPlayer(1, Cards.units.shd.wookieeWarrior).WithGroundUnitForPlayer(2, CSF).WithGroundUnitForPlayer(2, MARINE).Build());
    await attackUnit(g, 1, g.state.player2.groundArena[0].playId); // the 2/5 Warrior takes 3
    await pick(g, [g.state.player2.groundArena[1].playId]);
    expect(g.state.player2.groundArena.find(u => u.cardId === MARINE)).toBeUndefined(); // 3 into the 3/3
  });
});
