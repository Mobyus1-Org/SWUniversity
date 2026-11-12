import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IC27_172 Razor Crest — Stay Off the Ice (2/5 Space, cost 3, Cunning)
//   "Each unit (including friendly units) loses all 'When Defeated' abilities."
// Rules points: a "When Played/When Defeated" ability is a When Defeated ability, so it is lost whole
// (no When Played either). Last-known information: a Razor Crest defeated in the SAME defeat still
// applies. Bounty is not a When Defeated ability.

const CREST = Cards.units.ic27.razorCrest;
const BLACK_ONE = Cards.units.ic27.blackOne;     // 2/2 space — "When Played/When Defeated: Draw a card."
const XWING = Cards.units.sor.allianceXWing;      // 2/3 space — kills Black One, survives it
const MARINE = Cards.units.sor.battlefieldMarine;
const CSF = Cards.units.sor.consularSecurityForce; // 3/7

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithCardInDeckForPlayer(1, MARINE).WithCardInDeckForPlayer(1, MARINE)
    .WithCardInDeckForPlayer(2, MARINE).WithCardInDeckForPlayer(2, MARINE);
}

async function attack(g: GameTestAdapter, player: 1 | 2, arena: "ground" | "space", idx: number, targetPlayId: string) {
  if (arena === "space") await g.attackWithSpaceUnitAsync(player, idx);
  else await g.attackWithGroundUnitAsync(player, idx);
  await g.dispatchAsync(player, "choose-target", { targetPlayIds: [targetPlayId] });
}

describe("IC27_172 Razor Crest", () => {
  it("control: without Razor Crest, a defeated Black One draws", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, BLACK_ONE).WithSpaceUnitForPlayer(2, XWING).Build());

    await attack(g, 1, "space", 0, g.state.player2.spaceArena[0].playId);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(1);
  });

  it("a friendly unit loses its When Defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CREST).WithSpaceUnitForPlayer(1, BLACK_ONE)
      .WithSpaceUnitForPlayer(2, XWING).Build());

    await attack(g, 1, "space", 1, g.state.player2.spaceArena[0].playId);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([CREST]);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("an enemy unit loses its When Defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CREST).WithSpaceUnitForPlayer(2, BLACK_ONE).WithActivePlayer(2).Build());

    await attack(g, 2, "space", 0, g.state.player1.spaceArena[0].playId);

    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(0);
  });

  it("an upgrade-granted When Defeated is lost too (Droid Cohort)", async () => {
    const g = new GameTestAdapter();
    const state = board().WithSpaceUnitForPlayer(1, CREST).WithGroundUnitForPlayer(1, MARINE)
      .WithGroundUnitForPlayer(2, CSF).Build();
    state.player1.groundArena[0].upgrades = [{ cardId: Cards.upgrades.twi.droidCohort, playId: "dc", owner: 1, controller: 1 }];
    state.player1.groundArena[0].damage = 1; // 3/4 with the upgrade — CSF's 3 finishes it
    g.loadNewState(state);

    await attack(g, 1, "ground", 0, g.state.player2.groundArena[0].playId);

    expect(g.state.player1.groundArena).toHaveLength(0); // no Battle Droid
  });

  it("a blanked Razor Crest takes nothing away", async () => {
    const g = new GameTestAdapter();
    const state = board().WithSpaceUnitForPlayer(1, CREST).WithSpaceUnitForPlayer(1, BLACK_ONE)
      .WithSpaceUnitForPlayer(2, XWING).Build();
    state.currentEffects.push({
      cardId: Cards.events.sor.forceLightning, duration: "Phase", affectedPlayer: 1,
      targetPlayId: state.player1.spaceArena[0].playId,
    });
    g.loadNewState(state);

    await attack(g, 1, "space", 1, g.state.player2.spaceArena[0].playId);

    expect(g.state.player1.hand).toHaveLength(1);
  });

  it("last-known information: a Razor Crest defeated in the same combat still applies", async () => {
    const g = new GameTestAdapter();
    // Razor Crest (2/5) at 3 damage defends against Black One (2/2): both die together.
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CREST, true, 3).WithSpaceUnitForPlayer(2, BLACK_ONE).WithActivePlayer(2).Build());

    await attack(g, 2, "space", 0, g.state.player1.spaceArena[0].playId);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player2.spaceArena).toHaveLength(0);
    expect(g.state.player2.hand).toHaveLength(0);
  });

  it("last-known information in a wipe: Razor Crest swept FIRST still strips the units after it", async () => {
    const g = new GameTestAdapter();
    // Snoke's 4 kills the Crest (1 HP left) and then Black One, in one sweep. Snoke itself draws one
    // card per friendly unit defeated (2); Black One's own draw is lost.
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CREST, true, 4).WithSpaceUnitForPlayer(1, BLACK_ONE)
      .FillResourcesForPlayer(1, MARINE, 12).WithCardInHandForPlayer(1, Cards.units.ic27.snoke)
      .WithCardInDeckForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena).toHaveLength(0);
    expect(g.state.player1.hand).toHaveLength(2);
  });

  it("once Razor Crest is gone, When Defeated is back", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CREST, true, 4).WithSpaceUnitForPlayer(1, BLACK_ONE)
      .WithSpaceUnitForPlayer(2, XWING).WithSpaceUnitForPlayer(2, XWING).Build());

    await attack(g, 1, "space", 0, g.state.player2.spaceArena[0].playId); // Crest dies to the X-Wing
    expect(g.state.player1.spaceArena.map(u => u.cardId)).toEqual([BLACK_ONE]);
    await g.dispatchAsync(2, "pass-action", {});
    await attack(g, 1, "space", 0, g.state.player2.spaceArena[1].playId);

    expect(g.state.player1.hand).toHaveLength(1);
  });

  it("a 'When Played/When Defeated' unit entering under Razor Crest gets no When Played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, CREST).FillResourcesForPlayer(1, MARINE, 10)
      .WithCardInHandForPlayer(1, BLACK_ONE).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.state.player1.spaceArena.map(u => u.cardId)).toContain(BLACK_ONE);
    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.deck).toHaveLength(2);
  });
});
