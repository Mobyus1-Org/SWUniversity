import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const DARKSABER = Cards.upgrades.ts26.theDarksaber;
const PONG = Cards.units.lof.pongKrell;      // Grit
const EXECUTOR = Cards.units.jtl.executor;   // Overwhelm
const JIH = Cards.units.lof.jediInHiding;    // Hidden

// TS26_22 The Darksaber: "Attached unit gains Sentinel. When Played: If there are 4 or more different keywords among
// friendly units, ready attached unit."
describe("TS26_22 The Darksaber (Only the Strongest Shall Rule)", () => {
  const setup = (withHidden: boolean) => {
    let b = board().WithGroundUnitForPlayer(1, MARINE, false).WithGroundUnitForPlayer(1, PONG).WithSpaceUnitForPlayer(1, EXECUTOR).WithCardInHandForPlayer(1, DARKSABER);
    if (withHidden) b = b.WithGroundUnitForPlayer(1, JIH);
    return load(b.Build());
  };
  const play = async (g: ReturnType<typeof setup>) => { await F.playFromHand(g); await F.pick(g, [g.state.player1.groundArena[0].playId]); };

  it("the attached unit gains Sentinel", async () => {
    const g = setup(false);
    await play(g);
    const m = g.state.player1.groundArena[0];
    expect(HasKeyword(m.cardId, "Sentinel", m.playId, 1)).toBe(true);
  });

  it("4 different friendly keywords (its own Sentinel included): readies the unit", async () => {
    const g = setup(true); // Grit, Overwhelm, Hidden + Sentinel
    await play(g);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
  });

  it("only 3: stays exhausted", async () => {
    const g = setup(false); // Grit, Overwhelm + Sentinel
    await play(g);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });
});
