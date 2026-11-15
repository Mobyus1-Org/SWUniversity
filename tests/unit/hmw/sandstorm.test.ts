import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE, CSF, XWING } = F;
const SANDSTORM = Cards.events.hmw.sandstorm; // cost 3, Cunning
const DUNE_SEA = Cards.bases.hmw.duneSea;
const WEAKNESS = Cards.units.token.weakness;
const spent = (g: ReturnType<typeof load>) => g.state.player1.resources.filter(r => !r.ready).length;

// HMW_240 Sandstorm: "While you control a Tatooine base, this event costs 1 resource less to play. Choose an arena. Give a
// Weakness token to each exhausted enemy unit in that arena."
describe("HMW_240 Sandstorm", () => {
  const setup = (tatooine: boolean) => {
    let b = board(Cards.leaders.sor.hanSolo).WithGroundUnitForPlayer(2, CSF, false).WithGroundUnitForPlayer(2, CSF).WithSpaceUnitForPlayer(2, XWING, false).WithGroundUnitForPlayer(1, MARINE, false).WithCardInHandForPlayer(1, SANDSTORM);
    if (tatooine) b = b.MyBase(DUNE_SEA, 10);
    return load(b.Build());
  };
  const weak = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === WEAKNESS).length;

  it("each exhausted enemy unit in the chosen arena gets a Weakness token", async () => {
    const g = setup(false);
    await F.playFromHand(g);
    await g.chooseOptionAsync(1, "ground");
    expect(g.state.player2.groundArena.map(weak)).toEqual([1, 0]);
    expect(weak(g.state.player2.spaceArena[0])).toBe(0);
    expect(weak(g.state.player1.groundArena[0])).toBe(0);
  });

  it("costs 1 less with a Tatooine base", async () => {
    const g = setup(true);
    await F.playFromHand(g);
    expect(spent(g)).toBe(2);
  });

  it("full cost otherwise", async () => {
    const g = setup(false);
    await F.playFromHand(g);
    expect(spent(g)).toBe(3);
  });
});
