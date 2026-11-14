import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import type { NeedsOption } from "@/lib/engine/message-types";

// IC27_029 Chimaera — Grand Admiral's Might (8/8 Space, cost 10, Vigilance/Villainy) —
//   "Shielded"
//   "When Played: Give an Experience token to each friendly unit for each upgrade on it. Then,
//    heal 1 damage from your base for each friendly upgrade."
//
// The per-unit count is read once, before any token is handed out — the new Experience tokens
// are themselves upgrades and must not feed back into the count. The heal is counted AFTER
// ("Then"), so it does include them. Shielded and the When Played trigger together; resolving
// Shielded first lets the Chimaera count its own Shield.

const CHIMAERA = Cards.units.ic27.chimaera;
const MARINE = Cards.units.sor.battlefieldMarine;
const RESILIENT = Cards.upgrades.sor.resilient;
const XP = Cards.upgrades.token.experience;
const SHIELD = Cards.upgrades.token.shield;

const up = (cardId: string, owner: 1 | 2) => ({ cardId, playId: "@", owner, controller: owner });
const xpOn = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;
const options = (g: GameTestAdapter) =>
  (g.lastDispatchResponse?.resolutionNeeded as NeedsOption | undefined)?.options ?? [];

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP, 20)
    .MyLeader(Cards.leaders.sor.idenVersio) // Vigilance/Villainy
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, CHIMAERA)
    .WithActivePlayer(1);
}

async function playChimaera(g: GameTestAdapter, first: "Shielded" | "When Played") {
  await g.playCardFromHandAsync(1, 0);
  const pick = options(g).find(o => o.endsWith(first));
  if (pick) await g.chooseOptionAsync(1, pick);
}

describe("IC27_029 Chimaera", () => {
  it("has Shielded", () => {
    expect(HasShielded(CHIMAERA)).toBe(true);
  });

  it("gives each friendly unit one Experience token per upgrade on it, read before any are given", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESILIENT, 1), up(XP, 1)]) // 2 upgrades
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [up(RESILIENT, 1)])            // 1 upgrade
        .Build(),
    );

    await playChimaera(g, "When Played");

    const ground = g.state.player1.groundArena;
    expect(xpOn(ground[0])).toBe(1 + 2); // its own XP plus 2 new
    expect(xpOn(ground[1])).toBe(1);
    expect(xpOn(ground[2])).toBe(0);     // no upgrades → nothing
  });

  it("does not give enemy units anything", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(RESILIENT, 2)])
        .Build(),
    );

    await playChimaera(g, "When Played");

    expect(xpOn(g.state.player2.groundArena[0])).toBe(0);
  });

  it("then heals 1 from your base for each friendly upgrade, counting the new tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [up(RESILIENT, 1)])
        .Build(),
    );

    await playChimaera(g, "When Played");

    // Resilient + the Marine's new XP + the Chimaera's Shield (Shielded resolves after, but
    // here When Played went first, so the Shield isn't there yet) → 2.
    expect(g.state.player1.base.damage).toBe(20 - 2);
  });

  it("resolving Shielded first lets the Chimaera count its own Shield", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await playChimaera(g, "Shielded");

    const chimaera = g.state.player1.spaceArena[0];
    expect(chimaera.upgrades.filter(u => u.cardId === SHIELD).length).toBe(1);
    expect(xpOn(chimaera)).toBe(1);
    expect(g.state.player1.base.damage).toBe(20 - 2); // Shield + XP
  });

  it("an enemy-controlled upgrade does not count toward the heal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [up(RESILIENT, 2)])
        .Build(),
    );

    await playChimaera(g, "When Played");

    expect(g.state.player1.base.damage).toBe(20);
  });
});
