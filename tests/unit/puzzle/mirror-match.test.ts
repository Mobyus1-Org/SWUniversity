import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { solve } from "@/server/puzzle/solver";
import { computeMirrorMatch, mirrorSetupError } from "@/server/puzzle/mirror-match";
import type { RawPuzzleGameState } from "@/server/puzzle/adapters/puzzle-runtime";
import type { GameState } from "@/lib/engine/game";
import { POWER_MOD } from "@/lib/engine/core-models";
import { puzzleOutcome } from "@/util/puzzle-win-condition";
import { Cards } from "../../card-helpers";

// Mirror: your side of the table must match your opponent's exactly. Units are compared head to
// head by arena position (index i faces index i) on everything visible — card (title + subtitle,
// so reprints match), power, remaining HP, damage, ready, keywords, upgrades, captives — plus the
// base, the leader, resources (count and ready) and Credit/Force tokens. Ownership is invisible on
// the table and is ignored. Hand, deck and discard never count.

const MARINE = Cards.units.sor.battlefieldMarine; // 3/3 Ground
const CSF = Cards.units.sor.consularSecurityForce; // 3/7 Ground
const WEAKNESS = Cards.units.token.weakness;

/** Both sides identical: a Marine and a Consular Security Force in the ground arena. */
function mirrored(): GameStateBuilder {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, 4)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, 4)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 3)
    .FillResourcesForPlayer(2, MARINE, 3)
    .WithGroundUnitForPlayer(1, MARINE)
    .WithGroundUnitForPlayer(1, CSF)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithGroundUnitForPlayer(2, CSF);
}

const ground = (gs: GameState, player: 1 | 2, i: number) =>
  (player === 1 ? gs.player1 : gs.player2).groundArena[i];

describe("computeMirrorMatch", () => {
  it("an identical board matches every check", () => {
    const m = computeMirrorMatch(mirrored().Build());
    // 2 ground positions + base + leader + resources + tokens
    expect(m).toEqual({ matched: 6, total: 6, mismatches: [] });
  });

  it("ignores hand, deck and discard", () => {
    const gs = mirrored()
      .WithCardInHandForPlayer(1, MARINE)
      .WithCardInHandForPlayer(1, MARINE)
      .WithCardInDeckForPlayer(2, MARINE)
      .Build();
    expect(computeMirrorMatch(gs).mismatches).toEqual([]);
  });

  it("matches a reprint as the same card", () => {
    const gs = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .WithGroundUnitForPlayer(1, Cards.units.hmw.adamantEwoks)
      .WithGroundUnitForPlayer(2, Cards.units.hmw.adamantEwoksPromo)
      .Build();
    expect(computeMirrorMatch(gs).mismatches).toEqual([]);
  });

  describe("units, head to head", () => {
    it("damage", () => {
      const gs = mirrored().Build();
      ground(gs, 1, 1).damage = 2;
      expect(computeMirrorMatch(gs)).toMatchObject({ matched: 5, total: 6, mismatches: ["Ground 2"] });
    });

    it("ready / exhausted", () => {
      const gs = mirrored().Build();
      ground(gs, 2, 0).ready = false;
      expect(computeMirrorMatch(gs).mismatches).toEqual(["Ground 1"]);
    });

    it("position — the same units in a different order don't match", () => {
      const gs = new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(1, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build();
      expect(computeMirrorMatch(gs).mismatches).toEqual(["Ground 1", "Ground 2"]);
    });

    it("an extra unit on one side is an unmatched position", () => {
      const gs = mirrored().WithGroundUnitForPlayer(2, MARINE).Build();
      expect(computeMirrorMatch(gs)).toMatchObject({ matched: 6, total: 7, mismatches: ["Ground 3"] });
    });

    it("power from an effect", () => {
      const gs = mirrored().Build();
      gs.currentEffects.push({ cardId: POWER_MOD, duration: "Phase", affectedPlayer: 1, targetPlayId: ground(gs, 1, 0).playId, value: 2 });
      expect(computeMirrorMatch(gs).mismatches).toEqual(["Ground 1"]);
    });

    it("a granted keyword (Sentinel for this phase)", () => {
      const gs = mirrored().Build();
      // Gladiator Star Destroyer's When Played grant, as the engine stores it.
      gs.currentEffects.push({ cardId: Cards.units.sor.gladiatorStarDestroyer, duration: "Phase", affectedPlayer: 2, targetPlayId: ground(gs, 2, 1).playId });
      expect(computeMirrorMatch(gs).mismatches).toEqual(["Ground 2"]);
    });

    it("upgrades, with ownership ignored", () => {
      const withWeakness = (owner: 1 | 2) => [{ cardId: WEAKNESS, playId: `w${owner}`, owner, controller: owner }];
      const oneSide = mirrored().WithUpgradesOnGroundUnitForPlayer(1, 1, withWeakness(1)).Build();
      expect(computeMirrorMatch(oneSide).mismatches).toEqual(["Ground 2"]);

      // P1's Weakness is their own, P2's was given by P1 — the table still looks the same.
      const bothSides = mirrored()
        .WithUpgradesOnGroundUnitForPlayer(1, 1, withWeakness(1))
        .WithUpgradesOnGroundUnitForPlayer(2, 1, withWeakness(1))
        .Build();
      expect(computeMirrorMatch(bothSides).mismatches).toEqual([]);
    });

    it("captives", () => {
      const gs = mirrored().Build();
      ground(gs, 1, 1).captives.push({ ...ground(gs, 2, 0), playId: "captive-1" });
      expect(computeMirrorMatch(gs).mismatches).toEqual(["Ground 2"]);
    });
  });

  it("base damage", () => {
    const gs = mirrored().Build();
    gs.player2.base.damage = 7;
    expect(computeMirrorMatch(gs).mismatches).toEqual(["Base"]);
  });

  it("leader state", () => {
    const gs = mirrored().Build();
    gs.player1.leader.ready = false;
    expect(computeMirrorMatch(gs).mismatches).toEqual(["Leader"]);

    const epic = mirrored().Build();
    epic.player2.leader.epicActionUsed = true;
    expect(computeMirrorMatch(epic).mismatches).toEqual(["Leader"]);
  });

  it("resources: count and how many are ready", () => {
    const count = mirrored().FillResourcesForPlayer(1, MARINE, 1).Build();
    expect(computeMirrorMatch(count).mismatches).toEqual(["Resources"]);

    const ready = mirrored().Build();
    ready.player1.resources[0].ready = false;
    expect(computeMirrorMatch(ready).mismatches).toEqual(["Resources"]);
  });

  it("Credit and Force tokens", () => {
    const credits = mirrored().Build();
    credits.player1.supplemental.creditTokens = 1;
    expect(computeMirrorMatch(credits).mismatches).toEqual(["Tokens"]);

    const force = mirrored().Build();
    force.player2.supplemental.forceToken = true;
    expect(computeMirrorMatch(force).mismatches).toEqual(["Tokens"]);
  });
});

describe("mirror outcome", () => {
  it("wins only when matched, nothing is pending, and still in the action phase", () => {
    const gs = mirrored().Build();
    expect(puzzleOutcome(gs, "mirror", false, true)).toBe("won");
    expect(puzzleOutcome(gs, "mirror", false, false)).toBe("playing");
    expect(puzzleOutcome(gs, "mirror", true, true)).toBe("playing");
    expect(puzzleOutcome({ ...gs, gamePhase: "RegroupDraw" }, "mirror", false, true)).toBe("playing");
  });

  it("any defeated base fails the puzzle", () => {
    const gs = mirrored().Build();
    expect(puzzleOutcome({ ...gs, defeatedPlayers: [2] }, "mirror", false, true)).toBe("lost");
    expect(puzzleOutcome({ ...gs, defeatedPlayers: [1] }, "mirror", false, true)).toBe("lost");
  });
});

describe("mirrorSetupError", () => {
  it("rejects a board that already matches", () => {
    expect(mirrorSetupError(mirrored().Build())).toMatch(/already/i);
  });

  it("rejects different leaders or bases", () => {
    const leaders = mirrored().TheirLeader(Cards.leaders.sor.directorKrennic).Build();
    expect(mirrorSetupError(leaders)).toMatch(/leader/i);

    const bases = mirrored().TheirBase(Cards.bases.common.red30HP, 4).Build();
    expect(mirrorSetupError(bases)).toMatch(/base/i);
  });

  it("accepts a fresh mirror puzzle", () => {
    const gs = mirrored().Build();
    gs.player1.base.damage = 0;
    expect(mirrorSetupError(gs)).toBeNull();
  });
});

describe("solve() with mirror", () => {
  // P1's ready Marine faces P2's exhausted one, and P1's base has 3 damage to P2's none. Attacking
  // P2's base with the Marine exhausts it and deals 3: the two sides then match exactly.
  function rawMirror(): RawPuzzleGameState {
    const marine = (owner: 1 | 2, ready: boolean) =>
      ({ cardId: MARINE, playId: "@", owner, controller: owner, ready, damage: 0, upgrades: [], captives: [] });
    const side = (baseDamage: number, unitReady: boolean, owner: 1 | 2) => ({
      base: { cardId: Cards.bases.common.green30HP, damage: baseDamage, epicActionUsed: true },
      leader: { cardId: Cards.leaders.sor.sabineWren, ready: false, deployed: false, epicActionUsed: true },
      groundArena: [marine(owner, unitReady)],
      spaceArena: [],
      resources: [],
      discard: [],
      deck: [{ cardId: MARINE }, { cardId: MARINE }],
      hand: [],
    });
    return {
      activePlayer: 1,
      gamePhase: 0,
      currentRound: 7,
      initiativePlayer: 2,
      initiativeClaimed: true,
      player1: side(3, true, 1),
      player2: side(0, false, 2),
      currentEffects: [],
      triggerBag: [],
    } as RawPuzzleGameState;
  }

  it("finds the mirroring attack; the same board has no lethal", () => {
    expect(solve(rawMirror(), 20_000, "mirror").solvable).toBe(true);
    expect(solve(rawMirror(), 20_000, "deal-lethal").solvable).toBe(false);
  });
});
