import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import { board, load, pick, prompt, MARINE, CSF } from "./scan-fixtures";

// SHD_192 Dryden Vos — Offering No Escape (5/7 Ground): "Shielded" / "When Played: Choose a captured card
// guarded by a unit you control. You may play it for free under your control."
describe("SHD_192 Dryden Vos", () => {
  it("plays a captive you guard, free, under your control (its owner keeps it)", async () => {
    const state = board().WithGroundUnitForPlayer(1, CSF).WithCardInHandForPlayer(1, Cards.units.shd.drydenVos).Build();
    state.player1.groundArena[0].captives = [{ cardId: MARINE, playId: "800", owner: 2, controller: 2, ready: false, damage: 0, upgrades: [], captives: [], numUses: 0, isClone: false }];
    const g = load(state);
    await g.playCardFromHandAsync(1, 0);
    // Dryden's Shielded and When Played may be ordered; resolve any order prompt, then accept.
    if (prompt(g)?.type === "Option" && (prompt(g) as { options?: string[] }).options?.some(o => o.includes("Shielded"))) {
      const opt = (prompt(g) as { options: string[] }).options.find(o => o.includes("When Played"))!;
      await g.chooseOptionAsync(1, opt);
    }
    await g.chooseYesAsync(1);
    await pick(g, ["800"]);
    const played = g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
    expect(played).toBeDefined();
    expect(played.owner).toBe(2);
    expect(g.state.player1.groundArena[0].captives.length).toBe(0);
  });
});
