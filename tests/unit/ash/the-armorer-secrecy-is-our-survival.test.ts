import { describe, it, expect } from "vitest";

import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

// ASH_064 The Armorer — Secrecy is Our Survival. Cost 6, 5/5 Ground, [Vigilance, Heroism].
//   "Shielded
//    When Played: Give a Shield token to each friendly unit with Shielded (including this one)."
//
// The filter is the Shielded KEYWORD, not the presence of a Shield token — so a unit that gained
// Shielded from elsewhere qualifies, and a Shield token on a unit without the keyword does not.
// She is covered by her own filter, and her own Shielded fires too, so she ends up with two.

const ARMORER = Cards.units.ash.theArmorerSecrecyIsOurSurvival;
const SHIELDED_UNIT = Cards.units.sor.wildernessFighter;    // 3-cost Ground, Shielded only
const PLAIN_UNIT = Cards.units.sor.consularSecurityForce;   // 3/7 Ground, no keywords
const SHIELD = Cards.upgrades.token.shield;
const MARINE = Cards.units.sor.battlefieldMarine;

function base() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .WithCardInHandForPlayer(1, ARMORER);
}

function shields(g: GameTestAdapter, player: 1 | 2, cardId: string): number {
  const arena = player === 1 ? g.state.player1 : g.state.player2;
  const unit = [...arena.groundArena, ...arena.spaceArena].find(u => u.cardId === cardId);
  return unit?.upgrades.filter(u => u.cardId === SHIELD).length ?? 0;
}


/**
 * Plays the Armorer from hand and answers the ordering prompt her two simultaneous triggers
 * raise (her own Shielded, and her When Played). The order is immaterial to the outcome — she
 * has the keyword either way — so the tests fix it rather than asserting on it.
 */
async function playArmorer(g: GameTestAdapter, first: "Shielded" | "When Played" = "When Played") {
  await g.playCardFromHandAsync(1, 0);
  const res = g.lastDispatchResponse?.resolutionNeeded;
  if (res?.type === "Option" && (res.options ?? []).includes(`The Armorer — ${first}`)) {
    await g.chooseOptionAsync(1, `The Armorer — ${first}`);
  }
}

describe("ASH_064 The Armorer — Secrecy is Our Survival", () => {
  it("gives a Shield to another friendly unit that has Shielded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, SHIELDED_UNIT).Build());

    await playArmorer(g);

    expect(shields(g, 1, SHIELDED_UNIT)).toBe(1);
  });

  it("ends up with TWO Shields herself — her own Shielded, plus 'including this one'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().Build());

    await playArmorer(g);

    expect(shields(g, 1, ARMORER)).toBe(2);
  });

  it("reaches the same board whichever of her two triggers is resolved first", async () => {
    // Her Shielded and her When Played fire together, so the player orders them. Resolving the
    // When Played first is the interesting branch: she must already count as having Shielded.
    for (const first of ["Shielded", "When Played"] as const) {
      const g2 = new GameTestAdapter();
      g2.loadNewState(base().WithGroundUnitForPlayer(1, SHIELDED_UNIT).Build());

      await playArmorer(g2, first);

      expect(shields(g2, 1, ARMORER), `ordering: ${first} first`).toBe(2);
      expect(shields(g2, 1, SHIELDED_UNIT), `ordering: ${first} first`).toBe(1);
    }
  });

  it("gives nothing to a friendly unit WITHOUT Shielded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, PLAIN_UNIT).Build());

    await playArmorer(g);

    expect(shields(g, 1, PLAIN_UNIT)).toBe(0);
  });

  it("gives nothing to an ENEMY unit with Shielded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(2, SHIELDED_UNIT).Build());

    await playArmorer(g);

    expect(shields(g, 2, SHIELDED_UNIT)).toBe(0);
  });

  it("reaches friendly SPACE units as well — the clause names no arena", async () => {
    const g = new GameTestAdapter();
    // Privateer Scyk gains Shielded while you control another Cunning unit; the Armorer is not
    // Cunning, so a Cunning ground unit is supplied to switch it on.
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, "SHD_212")
        .WithGroundUnitForPlayer(1, Cards.units.sor.craftySmuggler) // Cunning
        .Build(),
    );

    await playArmorer(g);

    expect(shields(g, 1, "SHD_212")).toBe(1);
  });

  it("counts a GAINED Shielded, not just a printed one", async () => {
    const g = new GameTestAdapter();
    // Same Scyk, but with no other Cunning unit its conditional Shielded is off.
    g.loadNewState(base().WithSpaceUnitForPlayer(1, "SHD_212").Build());

    await playArmorer(g);

    expect(shields(g, 1, "SHD_212")).toBe(0);
  });

  it("gives one to a deployed Moff Gideon who copied Shielded out of the discard", async () => {
    // ASH_008's deployed side gains Shielded from an Imperial unit in the discard. Gaining the
    // keyword while already in play does nothing by itself — this is what makes it matter.
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .MyLeader(Cards.leaders.ash.moffGideonIndomitableWarlord)
        .WithCardInDiscardForPlayer(1, "ASH_193") // Emperor's Champion — Imperial, prints Shielded
        .Build(),
    );
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    // The copied Shielded is already live as he deploys, so it hands him one on the way in.
    expect(shields(g, 1, "ASH_008")).toBe(1);

    await playArmorer(g);

    expect(shields(g, 1, "ASH_008")).toBe(2);
  });
});
