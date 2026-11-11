import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { ActionAbilities } from "@/server/engine/actions/action-ability";

// IC27_070 C-3PO — Impulse Buy (1/3 Ground, cost 1, Command/Heroism)
//   "Action [Exhaust]: Give an Experience token to another unit. Then, if it has 6 or more power,
//    draw a card."

const C3PO = Cards.units.ic27.c3poImpulseBuy;
const MARINE = Cards.units.sor.battlefieldMarine;     // 3/3 → 4/4
const MACE = Cards.units.ic27.maceWindu;               // 5/5 → 6/6
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, C3PO)
    .WithCardInDeckForPlayer(1, MARINE);
}

const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

async function use(g: GameTestAdapter, targetPlayId: string) {
  await g.dispatchAsync(1, "use-ability", { cardId: C3PO, playId: g.state.player1.groundArena[0].playId });
  const res = g.lastDispatchResponse?.resolutionNeeded;
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [targetPlayId] });
  return res;
}

describe("IC27_070 C-3PO — Impulse Buy", () => {
  it("token to a unit that reaches 6 power: draws a card", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MACE).Build());

    await use(g, g.state.player1.groundArena[1].playId);

    expect(xp(g.state.player1.groundArena[1])).toBe(1);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
  });

  it("token to a unit left below 6 power: no draw", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    await use(g, g.state.player1.groundArena[1].playId);

    expect(xp(g.state.player1.groundArena[1])).toBe(1);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("may target an enemy unit (\"another unit\"), and still draws when it reaches 6", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MACE).Build());

    await use(g, g.state.player2.groundArena[0].playId);

    expect(xp(g.state.player2.groundArena[0])).toBe(1);
    expect(g.state.player1.hand).toHaveLength(1);
    expect(g.state.player2.hand).toHaveLength(0);
  });

  it("never offers himself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).Build());

    const res = await use(g, g.state.player1.groundArena[1].playId);

    expect(res?.type === "Target" ? res.fromPlayIds : []).toEqual([g.state.player1.groundArena[1].playId]);
  });

  it("is not offered with no other unit in play", () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    expect(ActionAbilities(C3PO, 1, g.state.player1.groundArena[0].playId)).not.toContain(C3PO);
  });
});
