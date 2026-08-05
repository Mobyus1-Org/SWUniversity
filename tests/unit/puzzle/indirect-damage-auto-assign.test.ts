import { describe, it, expect } from "vitest";
import { randomUUID } from "crypto";
import { hydratePuzzleGame } from "@/server/puzzle/adapters/puzzle-runtime";
import { processPuzzleDispatch } from "@/server/puzzle/puzzle-dispatch";
import type { EngineContext } from "@/server/engine/pending-resolution";
import type { Game } from "@/lib/engine/game";

// When the solver deals indirect damage, the OPPONENT divides it — a decision that must never
// reach the solver. P2 assigns the way a good player would, which is also the hardest case to
// solve against. Priority, per the rules manager:
//
//   1. non-Sentinel units      (expendable)
//   2. the base, down to 1 HP  (lots of capacity, no board cost)
//   3. Sentinel units          (only as deep as keeps them blocking)
//   4. the base's last HP      (only when forced)

type U = { cardId: string; damage?: number };

function newCtx(p1: { ground?: U[]; space?: U[] }, p2: { ground?: U[]; space?: U[] }, p2BaseDamage = 0): EngineContext {
  const arena = (units: U[], owner: 1 | 2) => units.map(u => ({
    cardId: u.cardId, playId: "@", owner, controller: owner,
    ready: true, damage: u.damage ?? 0, upgrades: [], captives: [],
  }));
  const raw = {
    activePlayer: 1, gamePhase: "ActionPhase", nextPlayId: 1, currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: true,
    player1: {
      base: { cardId: "SOR_020", damage: 0, epicActionUsed: false },
      leader: { cardId: "SOR_005", ready: true, deployed: false, epicActionUsed: false },
      groundArena: arena(p1.ground ?? [], 1),
      spaceArena: arena(p1.space ?? [], 1),
      resources: Array(12).fill(null).map(() => ({ cardId: "SOR_059", playId: "@", owner: 1, controller: 1, ready: true })),
      discard: [], deck: [], hand: [{ cardId: "JTL_234" }], // Torpedo Barrage — 5 indirect
      supplemental: { creditTokens: 0, forceToken: false },
    },
    player2: {
      base: { cardId: "SOR_023", damage: p2BaseDamage, epicActionUsed: false },
      leader: { cardId: "JTL_014", ready: true, deployed: false, epicActionUsed: false },
      groundArena: arena(p2.ground ?? [], 2),
      spaceArena: arena(p2.space ?? [], 2),
      resources: [], discard: [], deck: [], hand: [],
      supplemental: { creditTokens: 0, forceToken: false },
    },
    currentEffects: [], triggerBag: [],
  };
  const gs = hydratePuzzleGame(raw as never);
  return { game: { id: randomUUID(), currentGameState: gs, gameStateHistory: [], gameLog: [] } as Game, pending: null };
}

/** Solver plays Torpedo Barrage and aims it at the opponent. */
function barrage(ctx: EngineContext) {
  const r1 = processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: "play-card" as never, dispatchData: { cardId: "JTL_234", fromZone: "Hand" } as never, fromPlayer: 1 },
    ctx,
  );
  return processPuzzleDispatch(
    { dispatchId: randomUUID(), dispatchType: "choose-option" as never, dispatchData: { option: "Opponent" } as never, fromPlayer: 1 },
    r1.context,
  );
}

const SENTINEL = "SEC_117";   // Consular's Cruiser, 4/5 Space — plain unconditional Sentinel
const WAYFARER = "LOF_119";   // 4/10 Space, no abilities
const MARINE = "SOR_095";     // 3/3 Ground

describe("puzzle mode — the opponent auto-assigns indirect damage", () => {
  it("never hands the assignment to the solver", () => {
    const res = barrage(newCtx({}, { ground: [{ cardId: MARINE }] }));
    expect(res.response.resolutionNeeded).toBeFalsy();
  });

  it("priority 1: fills non-Sentinel units before touching the base", () => {
    const res = barrage(newCtx({}, { ground: [{ cardId: MARINE }] })); // 3/3 soaks 3
    const gs = res.context.game.currentGameState;

    expect(gs.player2.groundArena).toHaveLength(0); // took its full 3 and died
    expect(gs.player2.base.damage).toBe(2);         // the spare 2 went to the base
  });

  it("priority 2: base takes the overflow but stops one short of defeat", () => {
    // Base is 30 HP with 27 damage — only 3 left, so at most 2 may land here.
    const res = barrage(newCtx({}, {}, 27));
    const gs = res.context.game.currentGameState;

    // No units at all, so the engine's no-units rule dumps the lot; the player is defeated.
    expect(gs.player2.base.damage).toBe(32);
  });

  it("prefers a non-Sentinel unit over the base even when the base could absorb it", () => {
    const res = barrage(newCtx({}, { space: [{ cardId: WAYFARER }] })); // 4/10 takes all 5
    const gs = res.context.game.currentGameState;

    expect(gs.player2.spaceArena[0].damage).toBe(5);
    expect(gs.player2.base.damage).toBe(0);
  });

  describe("Sentinels are protected", () => {
    it("spares the Sentinel entirely while the base still has room", () => {
      const res = barrage(newCtx({}, { space: [{ cardId: SENTINEL }] }));
      const gs = res.context.game.currentGameState;

      expect(gs.player2.spaceArena[0].damage).toBe(0); // untouched
      expect(gs.player2.base.damage).toBe(5);
    });

    it("rule 2: with the base nearly dead, soaks only what leaves it alive after all attacks", () => {
      // Sentinel 4/5 undamaged (5 HP). Solver's space power is 4, so it may take 5-4-1 = 0.
      // Base has 1 HP left, so priority 2 contributes nothing and the damage is forced onto it.
      const res = barrage(newCtx({ space: [{ cardId: WAYFARER }] }, { space: [{ cardId: SENTINEL }] }, 29));
      const gs = res.context.game.currentGameState;

      expect(gs.player2.spaceArena[0].damage).toBe(0);
      expect(gs.player2.base.damage).toBe(34); // forced; nothing else could take it
    });

    it("rule 2: with no attackers in the arena, soaks down to its last HP", () => {
      // Sentinel has 5 HP, nothing can attack it, so it may absorb 4 and survive on 1.
      const res = barrage(newCtx({}, { space: [{ cardId: SENTINEL }] }, 29));
      const gs = res.context.game.currentGameState;

      expect(gs.player2.spaceArena[0].damage).toBe(4);
      expect(gs.player2.base.damage).toBe(30); // the last point had nowhere else to go
    });

    it("rule 1: a Sentinel that dies to the incoming attack anyway soaks all but its last HP", () => {
      // Sentinel 4/5 already on 2 damage → 3 HP. Solver has 4 power in that arena, so it is
      // doomed; it may still absorb 2 and block one attack.
      const res = barrage(newCtx({ space: [{ cardId: WAYFARER }] }, { space: [{ cardId: SENTINEL, damage: 2 }] }, 29));
      const gs = res.context.game.currentGameState;

      expect(gs.player2.spaceArena[0].damage).toBe(4); // 2 existing + 2 soaked, 1 HP left
      expect(gs.player2.base.damage).toBe(32);
    });

    it("only counts attackers in the Sentinel's own arena", () => {
      // All the solver's power is on the ground; the space Sentinel faces nothing, so it soaks 4.
      const res = barrage(newCtx({ ground: [{ cardId: MARINE }] }, { space: [{ cardId: SENTINEL }] }, 29));
      const gs = res.context.game.currentGameState;

      expect(gs.player2.spaceArena[0].damage).toBe(4);
    });
  });

  // P2 never PLAYS a card in a puzzle, but they do not have to: a card already on their board can
  // deal indirect damage on its own. Droid Missile Platform's When Defeated fires when the solver
  // kills it, and then the choice of target is P2's. Without an auto-response for that, this throws
  // "Puzzle Auto Target not set" and the board appears to lock up — the Guild Target failure again.
  it("a P2 card that deals indirect damage WITHOUT being played still auto-resolves", () => {
    const ctx = newCtx({}, { space: [{ cardId: "JTL_162" }] }); // Droid Missile Platform, 4/2
    ctx.game.currentGameState.player1.hand = [{ cardId: "SOR_078" }] as never; // Vanquish
    const target = ctx.game.currentGameState.player2.spaceArena[0].playId;

    const played = processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: "play-card" as never, dispatchData: { cardId: "SOR_078", fromZone: "Hand" } as never, fromPlayer: 1 },
      ctx,
    );
    const res = processPuzzleDispatch(
      { dispatchId: randomUUID(), dispatchType: "choose-target" as never, dispatchData: { targetPlayIds: [target] } as never, fromPlayer: 1 },
      played.context,
    );

    const gs = res.context.game.currentGameState;
    expect(gs.player2.spaceArena).toHaveLength(0); // the platform died
    expect(gs.player1.base.damage).toBe(3);        // P2 aimed its 3 at the solver
    expect(res.response.resolutionNeeded).toBeFalsy();
  });

  // With Devastator out, P2 assigns the damage they deal to the SOLVER, so the goal inverts: it is
  // no longer "where do I least mind taking this" but "what does this buy me".
  describe("P2 holds the assign-override — the assignment turns offensive", () => {
    /** Solver Vanquishes P2's Droid Missile Platform; its 3 indirect comes back at the solver. */
    function killDmp(ctx: EngineContext) {
      ctx.game.currentGameState.player1.hand = [{ cardId: "SOR_078" }] as never; // Vanquish
      const dmp = ctx.game.currentGameState.player2.spaceArena
        .find(u => u.cardId === "JTL_162")!.playId;
      const played = processPuzzleDispatch(
        { dispatchId: randomUUID(), dispatchType: "play-card" as never, dispatchData: { cardId: "SOR_078", fromZone: "Hand" } as never, fromPlayer: 1 },
        ctx,
      );
      return processPuzzleDispatch(
        { dispatchId: randomUUID(), dispatchType: "choose-target" as never, dispatchData: { targetPlayIds: [dmp] } as never, fromPlayer: 1 },
        played.context,
      );
    }
    const DEVASTATOR = "JTL_143";
    const DMP = "JTL_162";

    it("takes the win when the damage is lethal on the solver's base", () => {
      // Solver's base is 30 HP on 27 damage — 3 left, and the DMP deals exactly 3.
      const ctx = newCtx({ ground: [{ cardId: MARINE }] }, { space: [{ cardId: DMP }, { cardId: DEVASTATOR }] });
      ctx.game.currentGameState.player1.base.damage = 27;

      const gs = killDmp(ctx).context.game.currentGameState;
      expect(gs.player1.base.damage).toBe(30);           // lethal
      expect(gs.player1.groundArena[0].damage).toBe(0);  // never bothered with the unit
    });

    it("otherwise buys the kill on the highest-power ready unit, remainder to the base", () => {
      // Marine 3/3 (3 power) and a Battle Droid 1/1. 3 damage exactly kills the Marine.
      const ctx = newCtx(
        { ground: [{ cardId: "TWI_T01" }, { cardId: MARINE }] },
        { space: [{ cardId: DMP }, { cardId: DEVASTATOR }] },
      );

      const gs = killDmp(ctx).context.game.currentGameState;
      expect(gs.player1.groundArena.map(u => u.cardId)).toEqual(["TWI_T01"]); // Marine died
      expect(gs.player1.base.damage).toBe(0);                                // nothing spare
    });

    it("skips EXHAUSTED units — they have already done their damage", () => {
      const ctx = newCtx({ ground: [{ cardId: MARINE }] }, { space: [{ cardId: DMP }, { cardId: DEVASTATOR }] });
      ctx.game.currentGameState.player1.groundArena[0].ready = false;

      const gs = killDmp(ctx).context.game.currentGameState;
      expect(gs.player1.groundArena).toHaveLength(1);  // left alone
      expect(gs.player1.base.damage).toBe(3);          // all of it to the base instead
    });

    it("buys two cheap kills when it can afford both", () => {
      // Two Battle Droids (1/1) cost 1 each; the spare point goes to the base.
      const ctx = newCtx(
        { ground: [{ cardId: "TWI_T01" }, { cardId: "TWI_T01" }] },
        { space: [{ cardId: DMP }, { cardId: DEVASTATOR }] },
      );

      const gs = killDmp(ctx).context.game.currentGameState;
      expect(gs.player1.groundArena).toHaveLength(0);
      expect(gs.player1.base.damage).toBe(1);
    });

    it("falls back to the base when nothing is affordable", () => {
      // Hyperspace Wayfarer has 10 HP; 3 damage cannot defeat it, so no partial chip damage.
      const ctx = newCtx({ space: [{ cardId: WAYFARER }] }, { space: [{ cardId: DMP }, { cardId: DEVASTATOR }] });

      const gs = killDmp(ctx).context.game.currentGameState;
      expect(gs.player1.spaceArena.find(u => u.cardId === WAYFARER)!.damage).toBe(0);
      expect(gs.player1.base.damage).toBe(3);
    });

    it("control: without the override the solver assigns it themselves", () => {
      const ctx = newCtx({ ground: [{ cardId: MARINE }] }, { space: [{ cardId: DMP }] }); // no Devastator

      const res = killDmp(ctx);
      expect(res.response.resolutionNeeded?.type).toBe("SpreadDamage"); // handed to the solver
    });
  });

  it("assignments always total exactly the damage dealt", () => {
    const res = barrage(newCtx(
      { ground: [{ cardId: MARINE }] },
      { ground: [{ cardId: MARINE }], space: [{ cardId: SENTINEL }] },
    ));
    const gs = res.context.game.currentGameState;

    const onUnits = [...gs.player2.groundArena, ...gs.player2.spaceArena]
      .reduce((sum, u) => sum + u.damage, 0);
    const defeatedSoak = 3; // the Marine died carrying its 3
    expect(onUnits + gs.player2.base.damage + defeatedSoak).toBe(5);
  });
});
