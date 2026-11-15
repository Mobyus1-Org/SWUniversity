import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import { processDispatch } from "@/server/engine/dispatch-listener";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";
import { Cards } from "../../card-helpers";

// SHD_058 Val — Loyal to the End (2/4 Ground)
// "Bounty — Deal 3 damage to a unit.
//  When Defeated: Give 2 Experience tokens to a friendly unit."
//
// QA ("Violence is Not the Answer"): Sundari Peacekeeper kills Val, the solver collects the bounty
// and uses it to defeat P2's exhausted Unlicensed Headhunter, then collects ITS bounty. Val's When
// Defeated had been queued behind the bounty with its target list snapshotted at Val's death — the
// Headhunter alone — so it came back aimed at a unit that was gone, and the puzzle threw.

type RawUnit = { cardId: string; playId: string; owner: number; controller: number; ready: boolean; damage: number; upgrades: never[]; captives: never[] };
const unit = (cardId: string, player: number, extra: Partial<RawUnit> = {}): RawUnit =>
  ({ cardId, playId: "@", owner: player, controller: player, ready: true, damage: 0, upgrades: [], captives: [], ...extra });

function newCtx(p2Space: RawUnit[]): EngineContext {
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: Cards.bases.common.green30HP, damage: 20, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.lukeSkywalker, ready: false, deployed: false, epicActionUsed: false },
      groundArena: [unit(Cards.units.shd.sundariPeaceKeeper, 1)], // attacks for 3 with Raid 2
      spaceArena: [],
      resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: Cards.bases.common.green30HP, damage: 0, epicActionUsed: false },
      leader: { cardId: Cards.leaders.sor.grandMoffTarkin, ready: false, deployed: false, epicActionUsed: false },
      groundArena: [unit(Cards.units.shd.val, 2, { ready: false, damage: 2 })], // 2 HP left
      spaceArena: p2Space,
      resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
  const gs = hydratePuzzleGame(raw as never);
  return { game: { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] } as Game, pending: null };
}

// Exhausted, so it carries "Bounty — Heal 5 damage from your base."
const headhunter = () => unit(Cards.units.shd.unlicensedHeadhunter, 2, { ready: false });

type Run = typeof processDispatch;
function step(run: Run, ctx: EngineContext, type: string, data: Record<string, unknown>) {
  return run({ dispatchId: randomUUID(), dispatchType: type as never, dispatchData: data as never, fromPlayer: 1 }, ctx);
}

/** Sundari Peacekeeper attacks and defeats Val, leaving the solver on Val's bounty prompt. */
function killVal(run: Run, ctx: EngineContext) {
  const gs = ctx.game.currentGameState;
  const r1 = step(run, ctx, "initiate-attack", { playId: gs.player1.groundArena[0].playId });
  return step(run, r1.context, "choose-target", { targetPlayIds: [gs.player2.groundArena[0].playId] });
}

describe("SHD_058 Val — Loyal to the End", () => {
  it("puzzle: Val's bounty defeating P2's last unit drops the When Defeated instead of softlocking", () => {
    const ctx = newCtx([headhunter()]);
    const hh = ctx.game.currentGameState.player2.spaceArena[0].playId;

    let res = killVal(processPuzzleDispatch, ctx);
    res = step(processPuzzleDispatch, res.context, "choose-option", { option: "Yes" });
    res = step(processPuzzleDispatch, res.context, "choose-target", { targetPlayIds: [hh] });
    expect(res.context.game.currentGameState.player2.spaceArena).toHaveLength(0);
    expect(res.response.resolutionNeeded).toMatchObject({ helperText: "Collect bounty (Unlicensed Headhunter)?" });

    res = step(processPuzzleDispatch, res.context, "choose-option", { option: "Yes" });

    expect(res.context.pending).toBeNull();
    expect(res.context.game.currentGameState.player1.base.damage).toBe(13); // 20 − Restore 2 − Headhunter's 5
  });

  it("puzzle: P2 gives the 2 Experience tokens to its own unit without prompting the solver", () => {
    const ctx = newCtx([headhunter()]);

    let res = killVal(processPuzzleDispatch, ctx);
    res = step(processPuzzleDispatch, res.context, "choose-option", { option: "No" }); // decline the bounty

    expect(res.context.pending).toBeNull();
    const hh = res.context.game.currentGameState.player2.spaceArena[0];
    expect(hh.upgrades.filter(u => u.cardId === Cards.upgrades.token.experience)).toHaveLength(2);
  });

  it("only offers friendly units still in play once the bounty has defeated one of them", () => {
    const ctx = newCtx([headhunter(), unit(Cards.units.shd.unlicensedHeadhunter, 2)]);
    const [dead, survivor] = ctx.game.currentGameState.player2.spaceArena.map(u => u.playId);

    let res = killVal(processDispatch, ctx);
    res = step(processDispatch, res.context, "choose-option", { option: "Yes" });
    res = step(processDispatch, res.context, "choose-target", { targetPlayIds: [dead] });
    res = step(processDispatch, res.context, "choose-option", { option: "Yes" }); // the exhausted one's bounty

    expect(res.context.pending).toMatchObject({ type: "ability-target", cardId: "SHD_058_wd", player: 2 });
    expect(res.response.resolutionNeeded).toMatchObject({ fromPlayIds: [survivor] });
  });
});
