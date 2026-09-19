import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import type { GameState } from "@/lib/engine/game";

// "At the start of the (next) regroup phase, defeat it." — SOR_219 Sneak Attack, TWI_189 Unnatural
// Life, SHD_226 Unrefusable Offer and HMW_204 Nightbrother all mark the unit with an
// UntilStartOfRegroup effect. That is a real DEFEAT: the unit's When Defeated abilities fire and its
// upgrades leave play with it — not a quiet move to the discard pile.

const NIGHTBROTHER = Cards.units.hmw.nightbrotherMaulsGauntlet;
const OFFICIAL = Cards.units.twi.wartimeTradeOfficial; // "When Defeated: Create a Battle Droid token."
const BRUTE = Cards.units.jtl.onyxSquadronBrute;       // "When Defeated: Heal 2 damage from a base."
const FILLER = Cards.units.ash.deathTrooperSquad;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.yellow30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithInitiativePlayerBeing(1)
    .FillResourcesForPlayer(1, FILLER, 12)
    // Two cards each, so the regroup draw doesn't add empty-deck damage to the bases.
    .WithCardInDeckForPlayer(1, FILLER).WithCardInDeckForPlayer(1, FILLER)
    .WithCardInDeckForPlayer(2, FILLER).WithCardInDeckForPlayer(2, FILLER);
}

function discard(state: GameState, cardId: string, playId: string) {
  state.player1.discard.unshift({ cardId, playId, owner: 1, controller: 1, turnDiscarded: 1, discardEffect: "" });
  return playId;
}

/** Nightbrother replays `cardId` from the discard, then both players pass into the regroup phase. */
async function replayThenRegroup(g: GameTestAdapter, s: GameState, cardId: string) {
  const id = discard(s, cardId, "d-replay");
  s.player1.hand.push({ cardId: NIGHTBROTHER });
  g.loadNewState(s);
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [id] });
  expect([...g.state.player1.groundArena, ...g.state.player1.spaceArena].some(u => u.cardId === cardId)).toBe(true);
  await g.dispatchAsync(2, "pass-action", {});
  await g.dispatchAsync(1, "pass-action", {});
}

describe("Delayed 'defeat it at the start of the regroup phase'", () => {
  it("an automatic When Defeated fires (Wartime Trade Official makes its Battle Droid)", async () => {
    const g = new GameTestAdapter();
    await replayThenRegroup(g, base().Build(), OFFICIAL);

    expect(g.state.player1.discard.some(d => d.cardId === OFFICIAL)).toBe(true);
    expect(g.state.player1.groundArena.some(u => u.cardId === Cards.units.token.battleDroid)).toBe(true);
  });

  it("a When Defeated that needs a choice is presented to its player (Onyx Squadron Brute)", async () => {
    const g = new GameTestAdapter();
    const s = base().Build();
    s.player1.base.damage = 5;
    await replayThenRegroup(g, s, BRUTE);

    expect(g.state.player1.discard.some(d => d.cardId === BRUTE)).toBe(true);
    const res = g.lastDispatchResponse?.resolutionNeeded as { type?: string; fromPlayIds?: string[] };
    expect(res?.type).toBe("Target");
    expect(res.fromPlayIds).toEqual(expect.arrayContaining(["player1.base", "player2.base"]));

    await g.chooseBaseAsync(1, 1);
    expect(g.state.player1.base.damage).toBe(3);
  });

  it("its upgrades leave play with it — a card upgrade goes to its owner's discard", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithGroundUnitForPlayer(1, FILLER)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(Cards.upgrades.sor.entrenched, 1)])
      .Build();
    // Mark the unit the way Sneak Attack does when it plays one.
    s.currentEffects.push({
      cardId: "SOR_219", duration: "UntilStartOfRegroup", affectedPlayer: 1,
      targetPlayId: s.player1.groundArena[0].playId,
    });
    g.loadNewState(s);

    await g.dispatchAsync(1, "pass-action", {});
    await g.dispatchAsync(2, "pass-action", {});

    expect(g.state.player1.groundArena).toHaveLength(0);
    const discarded = g.state.player1.discard.map(d => d.cardId);
    expect(discarded).toContain(FILLER);
    expect(discarded).toContain(Cards.upgrades.sor.entrenched);
  });
});
