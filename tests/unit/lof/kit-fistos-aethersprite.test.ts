import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XP, SHIELD } = F;
const AETHERSPRITE = Cards.units.lof.kitFistosAethersprite;

// LOF_147 Kit Fisto's Aethersprite: "When Played: You may defeat any number of upgrades on a unit."
describe("LOF_147 Kit Fisto's Aethersprite", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(XP, 2), F.up(SHIELD, 2)]).WithCardInHandForPlayer(1, AETHERSPRITE).Build());
  const upgrades = (g: ReturnType<typeof setup>) => g.state.player2.groundArena[0].upgrades;

  it("defeats the chosen upgrades on the unit", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await F.pick(g, [upgrades(g).find(u => u.cardId === XP)!.playId]);
    expect(upgrades(g).map(u => u.cardId)).toEqual([SHIELD]);
  });

  it("all of them", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await F.pick(g, upgrades(g).map(u => u.playId));
    expect(upgrades(g)).toHaveLength(0);
  });

  it("none of them", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    await F.pick(g, []);
    expect(upgrades(g)).toHaveLength(2);
  });

  it("declining", async () => {
    const g = setup();
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(upgrades(g)).toHaveLength(2);
  });
});
