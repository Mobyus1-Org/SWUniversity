import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const STRANGER = Cards.units.law.theStranger; // 1/7, Grit

// LAW_086 The Stranger: "While attacking, you may have the defending unit deal combat damage before this unit."
describe("LAW_086 The Stranger", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, STRANGER).WithGroundUnitForPlayer(2, MARINE).Build());

  it("defender first: its damage pumps his Grit before he strikes", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseYesAsync(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena).toHaveLength(0); // 1 + 3 Grit = 4 into 3 HP
  });

  it("normal order: simultaneous, he deals only 1", async () => {
    const g = setup();
    await F.attackUnit(g, 0, g.state.player2.groundArena[0].playId);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena[0].damage).toBe(1);
  });

  it("attacking a base: no question", async () => {
    const g = setup();
    await F.attackBase(g);
    expect(F.prompt(g)).toBeNull();
  });
});
