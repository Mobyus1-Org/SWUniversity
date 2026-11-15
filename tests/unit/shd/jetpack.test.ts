import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, count, CSF, SHIELD } from "./scan-fixtures";

// SHD_225 Jetpack (+2/+0, non-Vehicle): "When Played: Give a Shield token to attached unit. At the start
// of the regroup phase, defeat that token." / Smuggle
describe("SHD_225 Jetpack", () => {
  it("a Shield now, defeated when the regroup phase starts", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, Cards.upgrades.shd.jetpack).Build());
    await g.playCardFromHandAsync(1, 0);
    await pick(g, [g.state.player1.groundArena[0].playId]);
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.dispatchAsync(1, "pass-action", {});
    expect(count(g.state.player1.groundArena[0], SHIELD)).toBe(0);
    expect(g.state.player1.groundArena[0].upgrades.some(u => u.cardId === Cards.upgrades.shd.jetpack)).toBe(true);
  });
});
