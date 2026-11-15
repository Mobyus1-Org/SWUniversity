import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF } = F;
const WRECKER = Cards.units.hmw.wrecker; // 6/6

// HMW_263 Wrecker: "When Played: Each player chooses a unit they control. Deal 3 damage to each chosen unit."
describe("HMW_263 Wrecker (Wrecking the Empire)", () => {
  it("each player picks one of their own units; both take 3", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, WRECKER).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await F.pick(g, [g.state.player2.groundArena[1].playId], 2);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
    expect(g.state.player2.groundArena.map(u => u.damage)).toEqual([0, 3]);
  });

  it("the opponent can't pick your unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, WRECKER).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    await F.pick(g, [g.state.player1.groundArena[0].playId], 2);
    expect(g.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("an opponent with no units: only your unit takes 3", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, WRECKER).Build());
    await F.playFromHand(g);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
