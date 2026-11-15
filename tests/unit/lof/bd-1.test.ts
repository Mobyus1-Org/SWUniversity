import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
const { board, load, MARINE, CSF, power } = F;
const BD1 = Cards.units.lof.bd1; // 1/3

// LOF_191 BD-1: "When Played: Choose another friendly unit. While this unit is in play, the chosen unit gets +1/+0 and
// gains Saboteur."
describe("LOF_191 BD-1", () => {
  const setup = () => load(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, CSF).WithCardInHandForPlayer(1, BD1).Build());
  const marine = (g: ReturnType<typeof setup>) => g.state.player1.groundArena.find(u => u.cardId === MARINE)!;

  it("the chosen unit gets +1/+0 and Saboteur", async () => {
    const g = setup();
    await F.playFromHand(g);
    await F.pick(g, [marine(g).playId]);
    expect(power(marine(g))).toBe(4);
    expect(HasKeyword(MARINE, "Saboteur", marine(g).playId, 1)).toBe(true);
  });

  it("only while BD-1 is in play", async () => {
    const g = load(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, BD1).WithCardInHandForPlayer(1, Cards.upgrades.lof.heavyBlasterCannon).Build());
    await F.playFromHand(g);
    await F.pick(g, [marine(g).playId]);
    await g.dispatchAsync(2, "pass-action", {});
    await F.playFromHand(g); // Heavy Blaster Cannon on the Marine: three 1-damage pings kill BD-1 (3 HP)
    await F.pick(g, [marine(g).playId]);
    await g.chooseYesAsync(1);
    await F.pick(g, [g.state.player1.groundArena.find(u => u.cardId === BD1)!.playId]);
    expect(g.state.player1.groundArena.some(u => u.cardId === BD1)).toBe(false);
    expect(power(marine(g))).toBe(3 + 2); // the Cannon's +2 only
    expect(HasKeyword(MARINE, "Saboteur", marine(g).playId, 1)).toBe(false);
  });
});
