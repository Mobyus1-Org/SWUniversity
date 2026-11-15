import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, SHIELD } = F;
const CANNON = Cards.upgrades.lof.heavyBlasterCannon;

// LOF_171 Heavy Blaster Cannon: "When Played: You may deal 1 damage to a ground unit. Then, deal 1 damage to the same
// unit. Then, deal 1 damage to the same unit."
describe("LOF_171 Heavy Blaster Cannon", () => {
  const setup = (shield = false) => {
    let b = board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, CANNON);
    if (shield) b = b.WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(SHIELD, 2)]);
    return load(b.Build());
  };
  const play = async (g: ReturnType<typeof setup>) => { await F.playFromHand(g); await F.pick(g, [g.state.player1.groundArena[0].playId]); };

  it("three separate 1-damage hits", async () => {
    const g = setup();
    await play(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].damage).toBe(3);
  });

  it("each hit is its own instance: a Shield stops only the first", async () => {
    const g = setup(true);
    await play(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player2.groundArena[0].playId]);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });

  it("declining: no damage", async () => {
    const g = setup();
    await play(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });
});
