import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE } = F;
const SABER = Cards.upgrades.ash.lukesJediLightsaber;
const LUKE = Cards.units.ash.lukeSkywalker;
const sentinel = (u: { cardId: string; playId: string }) => HasKeyword(u.cardId, "Sentinel", u.playId, 1);

// ASH_066 Luke's Jedi Lightsaber: "If attached unit is Luke Skywalker, he gains Sentinel."
describe("ASH_066 Luke's Jedi Lightsaber", () => {
  it("Luke Skywalker gains Sentinel", () => {
    const g = load(board().WithGroundUnitForPlayer(1, LUKE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).Build());
    expect(sentinel(g.state.player1.groundArena[0])).toBe(true);
  });

  it("anyone else: no Sentinel", () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(SABER, 1)]).Build());
    expect(sentinel(g.state.player1.groundArena[0])).toBe(false);
  });
});
