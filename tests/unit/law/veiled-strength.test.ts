import { describe, it, expect } from "vitest";
import { Cards } from "../../card-helpers";
import * as F from "../shd/scan-fixtures";
const { board, load, MARINE } = F;
const VEILED = Cards.upgrades.law.veiledStrength;
const LEIA_LEADER = Cards.leaders.sor.leiaOrgana;

// LAW_128 Veiled Strength: "Attach to a non-leader unit. Attached unit gains Grit."
describe("LAW_128 Veiled Strength", () => {
  it("a leader unit is not a legal host", async () => {
    const g = load(board().MyLeader(LEIA_LEADER, true, true).WithGroundUnitForPlayer(1, LEIA_LEADER).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, VEILED).Build());
    await F.playFromHand(g);
    const hosts = (F.prompt(g) as unknown as { fromPlayIds: string[] }).fromPlayIds;
    expect(hosts).toEqual([g.state.player1.groundArena[1].playId]);
  });
});
