import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, CSF, XWING } = F;
const ASTROMECH = Cards.units.jtl.astromechPilot;

// JTL_057 Astromech Pilot: "When played as an upgrade: You may heal 2 damage from a unit."
describe("JTL_057 Astromech Pilot", () => {
  const setup = () => load(board().WithSpaceUnitForPlayer(1, XWING).WithGroundUnitForPlayer(1, CSF, true, 3).WithCardInHandForPlayer(1, ASTROMECH).Build());
  const pilot = async (g: ReturnType<typeof setup>) => {
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.choosePilotVehicleSpaceAsync(1, 0);
  };

  it("played as an upgrade, heals 2 damage from a unit", async () => {
    const g = setup();
    await pilot(g);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena[0].playId]);
    expect(g.state.player1.groundArena[0].damage).toBe(1);
  });

  it("declining heals nothing", async () => {
    const g = setup();
    await pilot(g);
    await g.chooseNoAsync(1);
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });

  it("played as a unit, heals nothing", async () => {
    const g = setup();
    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Unit");
    expect(F.prompt(g)).toBeNull();
    expect(g.state.player1.groundArena[0].damage).toBe(3);
  });
});
