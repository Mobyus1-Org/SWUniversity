import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const CAMP = Cards.upgrades.hmw.insurgentCamp;
const TURTLE = Cards.units.ash.dinosaurTurtle; // 7 power

// HMW_216 Insurgent Camp: "Fortify. When you play a unit with 3 or less power: You may defeat this upgrade. If you do,
// ready that unit."
describe("HMW_216 Insurgent Camp", () => {
  const setup = (unit: string) => load(board().WithUpgradesOnBaseForPlayer(1, [F.up(CAMP, 1)]).WithCardInHandForPlayer(1, unit).Build());

  it("playing a 3-power unit: defeat the Camp to ready it", async () => {
    const g = setup(MARINE);
    await F.playFromHand(g);
    await g.chooseYesAsync(1);
    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(g.state.player1.base.upgrades ?? []).toHaveLength(0);
  });

  it("declining keeps the Camp", async () => {
    const g = setup(MARINE);
    await F.playFromHand(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player1.base.upgrades).toHaveLength(1);
  });

  it("a unit with more than 3 power: no offer", async () => {
    const g = setup(TURTLE);
    await F.playFromHand(g);
    expect(F.prompt(g)).toBeNull();
  });
});
