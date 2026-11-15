import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, hp } = F;
const RIFLE = Cards.upgrades.law.adventurerSniperRifle;

// LAW_126 Adventurer Sniper Rifle: attached unit gains "Action [Exhaust]: Choose an undamaged non-leader ground unit. Its
// printed HP is considered to be 1 for this phase."
describe("LAW_126 Adventurer Sniper Rifle", () => {
  const setup = (csfDamage = 0) => load(board().WithGroundUnitForPlayer(1, MARINE).WithUpgradesOnGroundUnitForPlayer(1, 0, [F.up(RIFLE, 1)]).WithGroundUnitForPlayer(2, CSF, true, csfDamage).Build());
  const use = (g: ReturnType<typeof setup>) => g.dispatchAsync(1, "use-ability", { cardId: RIFLE, playId: g.state.player1.groundArena[0].playId });

  it("the chosen unit's printed HP is 1; the host exhausts", async () => {
    const g = setup();
    await use(g);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(hp(g.state.player2.groundArena[0])).toBe(1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("a damaged unit is refused", async () => {
    const g = setup(1);
    await use(g);
    const choices = (F.prompt(g) as unknown as { fromPlayIds: string[] }).fromPlayIds;
    expect(choices).not.toContain(g.state.player2.groundArena[0].playId);
    expect(choices).toContain(g.state.player1.groundArena[0].playId); // the undamaged host itself is fair game
  });
});
