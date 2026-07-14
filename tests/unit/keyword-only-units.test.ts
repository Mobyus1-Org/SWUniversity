import { describe, it, expect, beforeEach } from "vitest";
import { GameTestAdapter } from "./game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";
import { CardText, CardType, GetAllCardIds, CardTitle } from "@/server/engine/card-db/generated";
import { Cards } from "../card-helpers";

// LAW/ASH units whose entire card text is keywords: implementing them means registering their
// keywords in the keyword dictionaries. The sweep below derives the expectation from the card
// data itself, so a newly-added keyword-only LAW/ASH unit fails here until it is registered.

// Support is a keyword the engine does not model yet — units carrying it are excluded from the
// sweep for that keyword only (their other keywords are still checked).
const UNMODELLED = new Set(["Support"]);

const AMOUNTLESS = /^(Ambush|Grit|Hidden|Overwhelm|Saboteur|Sentinel|Shielded|Support)$/;
const WITH_AMOUNT = /^(Raid|Restore|Exploit|Smuggle|Piloting|Bounty|Plot|Coordinate)\b/;

/** Card text with reminder text stripped, one entry per printed line. */
function abilityLines(cardId: string): string[] {
  return CardText(cardId)
    .split("\n")
    .map(line => line.replace(/\([^)]*\)/g, "").trim())
    .filter(Boolean);
}

function isKeywordLine(line: string): boolean {
  return AMOUNTLESS.test(line) || WITH_AMOUNT.test(line);
}

/** Every LAW/ASH unit whose printed text is nothing but keywords. */
function keywordOnlyUnits(): { cardId: string; keywords: string[] }[] {
  return GetAllCardIds()
    .filter(id => /^(LAW|ASH)_/.test(id) && CardType(id) === "Unit")
    .map(cardId => ({ cardId, lines: abilityLines(cardId) }))
    .filter(({ lines }) => lines.length > 0 && lines.every(isKeywordLine))
    .map(({ cardId, lines }) => ({
      cardId,
      keywords: lines.map(line => line.split(/\s+/)[0]).filter(kw => !UNMODELLED.has(kw)),
    }))
    .filter(({ keywords }) => keywords.length > 0);
}

describe("LAW/ASH keyword-only units", () => {
  beforeEach(() => {
    // HasKeyword reaches into the live game (e.g. ASH_040 Poe Dameron's "all units lose
    // Sentinel"), so a game must exist even for these static, no-playId lookups.
    new GameTestAdapter().loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .Build(),
    );
  });

  it("covers a meaningful number of cards", () => {
    // Guards against the sweep silently going empty if the card data or parsing changes.
    expect(keywordOnlyUnits().length).toBeGreaterThan(60);
  });

  it.each(keywordOnlyUnits())("$cardId has its printed keywords", ({ cardId, keywords }) => {
    for (const keyword of keywords) {
      expect(HasKeyword(cardId, keyword), `${CardTitle(cardId)} (${cardId}) is missing ${keyword}`)
        .toBe(true);
    }
  });
});

describe("keyword-only unit behaviour (spot checks)", () => {
  it("LAW_122 Shielded Hauler enters play with a Shield token", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 8)
        .WithCardInHandForPlayer(1, Cards.units.law.shieldedHauler)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);

    const hauler = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.law.shieldedHauler)!;
    expect(hauler.upgrades.filter(u => u.cardId === Cards.upgrades.token.shield)).toHaveLength(1);
  });

  it("LAW_199 Ohnaka Gang Bandits attacks with Raid 3 (6 power → 9 to the base)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.law.ohnakaGangBandits)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(9);
  });

  it("LAW_120 Vigilant Scouts heals 2 from your base with Restore 2 when it attacks", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 5)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.law.vigilantScouts)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(3); // 5 - 2
    expect(g.state.player2.base.damage).toBe(3); // 3 power, no Raid
  });

  it("ASH_117 Outland Protector has Sentinel; ASH_145 Praetorian Elite has Grit", () => {
    new GameTestAdapter().loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .Build(),
    );

    expect(HasKeyword(Cards.units.ash.outlandProtector, "Sentinel")).toBe(true);
    expect(HasKeyword(Cards.units.ash.praetorianElite, "Grit")).toBe(true);
  });
});
