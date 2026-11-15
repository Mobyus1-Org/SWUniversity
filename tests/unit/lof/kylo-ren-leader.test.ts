import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const KYLO = Cards.leaders.lof.kyloRen;
const SABER = Cards.upgrades.lof.inquisitorsLightsaber; // cost 2 upgrade, +1/+3
const COMPASS = Cards.upgrades.lof.pillioStarCompass;   // cost 2 upgrade, +1/+1

// LOF_001 Kylo Ren — We're Not Done Yet
//   Front: "Action [Exhaust]: Discard a card from your hand. If you discarded an upgrade this way, draw a card."
//   Deployed: "When Deployed: Play any number of upgrades from your discard pile on this unit (one at a time,
//             paying their costs)."
describe("LOF_001 Kylo Ren — leader Action", () => {
  const setup = () => load(board(KYLO).WithCardInHandForPlayer(1, SABER).WithCardInHandForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE).Build());

  it("discarding an upgrade draws a card", async () => {
    const g = setup();
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([SABER]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE, MARINE]);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("discarding a non-upgrade draws nothing", async () => {
    const g = setup();
    await g.useLeaderAbilityAsync(1);
    await g.chooseCardFromHandAsync(1, 1);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([SABER]);
  });
});

describe("LOF_001 Kylo Ren — When Deployed", () => {
  const setup = () => load(board(KYLO).WithCardInDiscardForPlayer(1, SABER).WithCardInDiscardForPlayer(1, COMPASS).WithCardInDiscardForPlayer(1, MARINE).Build());
  const kylo = (g: ReturnType<typeof setup>) => g.state.player1.groundArena.find(u => u.cardId === KYLO)!;
  const spent = (g: ReturnType<typeof setup>) => g.state.player1.resources.filter(r => !r.ready).length;
  const discardId = (g: ReturnType<typeof setup>, id: string) => g.state.player1.discard.find(c => c.cardId === id)!.playId!;
  /** Picks the upgrade from the discard, then Kylo as its host (he is the only legal one). */
  const playOnKylo = async (g: ReturnType<typeof setup>, id: string) => {
    await F.pick(g, [discardId(g, id)]);
    await F.pick(g, [kylo(g).playId]);
  };

  it("plays upgrades from the discard on him one at a time, paying for each", async () => {
    const g = setup();
    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1);
    await playOnKylo(g, SABER);
    expect(kylo(g).upgrades.map(u => u.cardId)).toEqual([SABER]);
    expect(spent(g)).toBe(2 + 2); // Command aspect penalty under Kylo
    await g.chooseYesAsync(1);
    await playOnKylo(g, COMPASS);
    expect(kylo(g).upgrades.map(u => u.cardId)).toEqual([SABER, COMPASS]);
    expect(g.state.player1.discard.map(c => c.cardId)).toEqual([MARINE]);
    expect(F.prompt(g)).toBeNull(); // no upgrades left, so no further offer (and the Compass's search has an empty deck)
  });

  it("stopping early leaves the rest in the discard", async () => {
    const g = setup();
    await g.deployLeaderAsync(1);
    await g.chooseNoAsync(1);
    expect(kylo(g).upgrades).toHaveLength(0);
    expect(g.state.player1.discard).toHaveLength(3);
  });

  it("a non-upgrade card in the discard is refused", async () => {
    const g = setup();
    await g.deployLeaderAsync(1);
    await g.chooseYesAsync(1);
    await F.pick(g, [discardId(g, MARINE)]);
    expect(kylo(g).upgrades).toHaveLength(0);
  });

  it("no upgrades in the discard: no offer", async () => {
    const g = load(board(KYLO).WithCardInDiscardForPlayer(1, MARINE).Build());
    await g.deployLeaderAsync(1);
    expect(F.prompt(g)).toBeNull();
  });
});
