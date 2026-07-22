import { describe, it, expect } from "vitest";
import { toRaw, type BuilderState, type PlayerBuilderState } from "@/components/Shared/puzzle-builder-state";

// QA bug reports, both traced to what the puzzle BUILDER saves:
//  1. "Captured units that are rescued return to play under the control of the player who had
//      taken the unit captive, not its owner."
//  2. "Captured units disappear if the unit guarding them is defeated."
//
// A unit can only capture an ENEMY non-leader unit (CR 8.33), so a captive held by player X's
// guard is owned by X's opponent — that is the side it returns to when released. The builder used
// to stamp the GUARD's player onto the captive, so every release path in the engine
// (releaseCaptives on guard defeat/bounce, rescueCaptiveByPlayId for on-demand rescue) faithfully
// handed the captive to the wrong player.

function player(overrides: Partial<PlayerBuilderState> = {}): PlayerBuilderState {
  return {
    baseCardId: "SOR_029", baseDamage: 0, baseEpicActionUsed: false,
    leaderCardId: "SOR_017", leaderReady: true, leaderDeployed: false, leaderEpicActionUsed: false,
    resources: [], handCards: [], deck: [], discard: [], groundUnits: [], spaceUnits: [],
    creditTokens: 0, forceToken: false,
    ...overrides,
  } as PlayerBuilderState;
}

function guardWithCaptive(captiveCardId: string) {
  return { cardId: "SOR_051", ready: true, damage: 0, upgrades: [], captives: [captiveCardId] };
}

function builderState(p1: PlayerBuilderState, p2: PlayerBuilderState): BuilderState {
  return {
    name: "t", description: "", infoText: "", difficulty: 1, author: "",
    intendedSolution: [], hints: [], assetPath: "",
    activePlayer: 1, gamePhase: "ActionPhase", currentRound: 1,
    initiativePlayer: 1, initiativeClaimed: false,
    player1: p1, player2: p2,
  } as BuilderState;
}

type RawUnit = { cardId: string; owner: number; controller: number; captives: RawUnit[] };
type RawPlayer = { groundArena: RawUnit[]; spaceArena: RawUnit[] };

describe("puzzle builder — captive ownership", () => {
  it("saves a captive under P1's guard as owned and controlled by P2", () => {
    const raw = toRaw(builderState(
      player({ groundUnits: [guardWithCaptive("SOR_100")] }),
      player(),
    )) as unknown as { player1: RawPlayer };

    const guard = raw.player1.groundArena[0];
    expect(guard.owner).toBe(1); // the guard itself is unchanged
    expect(guard.controller).toBe(1);

    const captive = guard.captives[0];
    expect(captive.cardId).toBe("SOR_100");
    expect(captive.owner).toBe(2);
    expect(captive.controller).toBe(2);
  });

  it("saves a captive under P2's guard as owned and controlled by P1", () => {
    const raw = toRaw(builderState(
      player(),
      player({ groundUnits: [guardWithCaptive("SOR_100")] }),
    )) as unknown as { player2: RawPlayer };

    const captive = raw.player2.groundArena[0].captives[0];
    expect(captive.owner).toBe(1);
    expect(captive.controller).toBe(1);
  });

  it("applies the same rule to space-arena guards", () => {
    const raw = toRaw(builderState(
      player({ spaceUnits: [{ cardId: "SOR_193", ready: true, damage: 0, upgrades: [], captives: ["SOR_100"] }] }),
      player(),
    )) as unknown as { player1: RawPlayer };

    const captive = raw.player1.spaceArena[0].captives[0];
    expect(captive.owner).toBe(2);
    expect(captive.controller).toBe(2);
  });

  it("leaves upgrades owned by the unit's controller", () => {
    const raw = toRaw(builderState(
      player({ groundUnits: [{ cardId: "SOR_051", ready: true, damage: 0, upgrades: ["SOR_120"], captives: [] }] }),
      player(),
    )) as unknown as { player1: { groundArena: Array<{ upgrades: Array<{ owner: number; controller: number }> }> } };

    const upgrade = raw.player1.groundArena[0].upgrades[0];
    expect(upgrade.owner).toBe(1);
    expect(upgrade.controller).toBe(1);
  });
});
