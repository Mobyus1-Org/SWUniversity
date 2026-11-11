import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CreateCloneTrooper } from "@/server/engine/token-helpers";

// IC27_076 Clone Commander Cody — Loyal to the Republic (4/4 Ground, cost 4, Command/Heroism)
//   "When another friendly Republic unit enters play: Give an Experience token to it."

const CODY = Cards.units.ic27.cloneCommanderCody;
const CLONE = Cards.units.twi.phaseIClonetrooper; // 3/2 Republic, no text
const MARINE = Cards.units.sor.battlefieldMarine; // Rebel, not Republic
const MACE_LEADER = Cards.leaders.ic27.maceWindu;  // Republic leader
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(MACE_LEADER)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(MACE_LEADER)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 10)
    .FillResourcesForPlayer(2, MARINE, 10);
}

const xp = (u: { upgrades: { cardId: string }[] } | undefined) => (u?.upgrades ?? []).filter(x => x.cardId === XP).length;
const find = (units: { cardId: string; upgrades: { cardId: string }[] }[], cardId: string) => units.find(u => u.cardId === cardId);

describe("IC27_076 Clone Commander Cody — Loyal to the Republic", () => {
  it("a friendly Republic unit played afterwards gets an Experience token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, CODY).WithCardInHandForPlayer(1, CLONE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(xp(find(g.state.player1.groundArena, CLONE))).toBe(1);
    expect(xp(find(g.state.player1.groundArena, CODY))).toBe(0);
  });

  it("a non-Republic friendly unit gets nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, CODY).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(xp(find(g.state.player1.groundArena, MARINE))).toBe(0);
  });

  it("an enemy Republic unit entering play gets nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithActivePlayer(2).WithGroundUnitForPlayer(1, CODY).WithCardInHandForPlayer(2, CLONE).Build());

    await g.playCardFromHandAsync(2, 0);

    expect(xp(find(g.state.player2.groundArena, CLONE))).toBe(0);
  });

  it("Cody entering play doesn't give himself a token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, CODY).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(xp(find(g.state.player1.groundArena, CODY))).toBe(0);
  });

  it("a Clone Trooper token created while he is in play gets one", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, CODY).Build());

    CreateCloneTrooper(g.state, 1, [], "TWI_043");

    expect(xp(find(g.state.player1.groundArena, Cards.units.token.cloneTrooper))).toBe(1);
  });

  it("a deployed friendly Republic leader gets one", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, CODY).Build());

    await g.deployLeaderAsync(1);

    expect(g.state.player1.leader.deployed).toBe(true);
    expect(xp(find(g.state.player1.groundArena, MACE_LEADER))).toBe(1);
  });

  it("control: without Cody a Republic unit enters with no token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, CLONE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(xp(find(g.state.player1.groundArena, CLONE))).toBe(0);
  });
});
