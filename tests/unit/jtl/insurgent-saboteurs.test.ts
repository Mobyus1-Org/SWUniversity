import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, XP } = F;
const SABOTEURS = Cards.units.jtl.insurgentSaboteurs;

// JTL_168 Insurgent Saboteurs: "On Attack: You may defeat an upgrade."
describe("JTL_168 Insurgent Saboteurs", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, SABOTEURS).WithGroundUnitForPlayer(2, MARINE).WithUpgradesOnGroundUnitForPlayer(2, 0, [F.up(XP, 2)]).Build());

  it("defeats an upgrade", async () => {
    const g = setup();
    await F.attackBase(g);
    await g.chooseYesAsync(1);
    await g.chooseUpgradeOnGroundUnitAsync(1, 2, 0);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(0);
  });

  it("declining keeps it", async () => {
    const g = setup();
    await F.attackBase(g);
    await g.chooseNoAsync(1);
    expect(g.state.player2.groundArena[0].upgrades).toHaveLength(1);
  });
});
