import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load } = F;
const TY = Cards.units.hmw.tyYorrick;                 // 4/5
const TURTLE = Cards.units.ash.dinosaurTurtle;        // 7/7 Creature
const TRESPASSER = Cards.units.hmw.miningGuildTrespasser;

// HMW_185 Ty Yorrick: "If a friendly ability would deal damage, you may have that ability deal that much damage plus 1
// instead. On Attack: You may deal 1 damage to a Creature unit."
describe("HMW_185 Ty Yorrick", () => {
  it("On Attack: 1 damage to an enemy Creature becomes 2", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TY).WithGroundUnitForPlayer(2, TURTLE).Build());
    await F.attackBase(g, 0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("the +1 is not taken against your own unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TY).WithGroundUnitForPlayer(1, TURTLE).Build());
    await F.attackBase(g, 0);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[1].playId]);
    expect(g.state.player1.groundArena[1].damage).toBe(1);
  });

  it("another friendly ability: +1 to an enemy base and an enemy unit", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TY).WithGroundUnitForPlayer(2, F.CSF).WithCardInHandForPlayer(1, TRESPASSER).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, ["player2.base"]);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.base.damage).toBe(10 + 3);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("control: without Ty the same ability deals 2", async () => {
    const g = load(board().WithGroundUnitForPlayer(2, F.CSF).WithCardInHandForPlayer(1, TRESPASSER).Build());
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, ["player2.base"]);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.base.damage).toBe(10 + 2);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("combat damage is not an ability: no +1", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, TY).Build());
    await F.attackBase(g, 0);
    expect(g.state.player2.base.damage).toBe(10 + 4);
  });
});
