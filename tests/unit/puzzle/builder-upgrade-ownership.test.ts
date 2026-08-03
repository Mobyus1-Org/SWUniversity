import { describe, it, expect } from "vitest";
import { toRaw, fromRaw, type BuilderState, type PlayerBuilderState } from "@/components/Shared/puzzle-builder-state";

// An upgrade on a unit is normally owned by that unit's controller — but not always. Frozen in
// Carbonite played by P2 onto a P1 unit is controlled by P2 while sitting on a P1 unit. The
// builder used to stamp the UNIT's player onto every upgrade, so enemy-owned upgrades were
// impossible to author, and importing one silently converted it back to friendly.

function player(overrides: Partial<PlayerBuilderState> = {}): PlayerBuilderState {
  return {
    baseCardId: "SOR_029", baseDamage: 0, baseEpicActionUsed: false,
    leaderCardId: "SOR_017", leaderReady: true, leaderDeployed: false, leaderEpicActionUsed: false,
    resources: [], handCards: [], deck: [], discard: [], groundUnits: [], spaceUnits: [],
    creditTokens: 0, forceToken: false,
    ...overrides,
  } as PlayerBuilderState;
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

type RawUpgrade = { cardId: string; playId: string; owner: number; controller: number };
type RawArena = Array<{ upgrades: RawUpgrade[] }>;
type RawSide = { groundArena: RawArena; spaceArena: RawArena; leader: { deployed: boolean; deployedPlayId?: string } };

describe("puzzle builder — upgrade ownership", () => {
  it("a friendly upgrade is owned and controlled by the unit's player", () => {
    const raw = toRaw(builderState(
      player({ groundUnits: [{ cardId: "SOR_051", ready: true, damage: 0, upgrades: [{ cardId: "SOR_120" }], captives: [] }] }),
      player(),
    )) as unknown as { player1: RawSide };

    const upgrade = raw.player1.groundArena[0].upgrades[0];
    expect(upgrade.owner).toBe(1);
    expect(upgrade.controller).toBe(1);
  });

  it("an enemy upgrade on a P1 unit is owned and controlled by P2", () => {
    const raw = toRaw(builderState(
      player({ groundUnits: [{ cardId: "SOR_051", ready: true, damage: 0, upgrades: [{ cardId: "SHD_193", enemy: true }], captives: [] }] }),
      player(),
    )) as unknown as { player1: RawSide };

    const upgrade = raw.player1.groundArena[0].upgrades[0];
    expect(upgrade.cardId).toBe("SHD_193");
    expect(upgrade.owner).toBe(2);
    expect(upgrade.controller).toBe(2);
  });

  it("an enemy upgrade on a P2 unit is owned and controlled by P1", () => {
    const raw = toRaw(builderState(
      player(),
      player({ groundUnits: [{ cardId: "SOR_051", ready: true, damage: 0, upgrades: [{ cardId: "SHD_193", enemy: true }], captives: [] }] }),
    )) as unknown as { player2: RawSide };

    const upgrade = raw.player2.groundArena[0].upgrades[0];
    expect(upgrade.owner).toBe(1);
    expect(upgrade.controller).toBe(1);
  });

  it("applies the same rule in the space arena", () => {
    const raw = toRaw(builderState(
      player({ spaceUnits: [{ cardId: "SOR_193", ready: true, damage: 0, upgrades: [{ cardId: "SHD_193", enemy: true }], captives: [] }] }),
      player(),
    )) as unknown as { player1: RawSide };

    expect(raw.player1.spaceArena[0].upgrades[0].owner).toBe(2);
  });

  it("round-trips the enemy flag through toRaw -> fromRaw", () => {
    const original = builderState(
      player({ groundUnits: [{ cardId: "SOR_051", ready: true, damage: 0, upgrades: [{ cardId: "SOR_120" }, { cardId: "SHD_193", enemy: true }], captives: [] }] }),
      player(),
    );
    const raw = toRaw(original) as unknown as Record<string, unknown>;
    const back = fromRaw(raw, { name: "t", description: "", difficulty: 1 });

    const upgrades = back.player1.groundUnits[0].upgrades;
    expect(upgrades[0]).toEqual({ cardId: "SOR_120", enemy: false });
    expect(upgrades[1]).toEqual({ cardId: "SHD_193", enemy: true });
  });
});

describe("puzzle builder — pilot leader as an upgrade", () => {
  it("gives the leader upgrade a stable playId and points deployedPlayId at it", () => {
    const raw = toRaw(builderState(
      player({
        leaderCardId: "JTL_012", // Luke Skywalker (Hero of Yavin) — a Pilot leader
        spaceUnits: [{ cardId: "SOR_193", ready: true, damage: 0, upgrades: [{ cardId: "JTL_012" }], captives: [] }],
      }),
      player(),
    )) as unknown as { player1: RawSide };

    const upgrade = raw.player1.spaceArena[0].upgrades[0];
    expect(upgrade.playId).toBe("L1");
    expect(raw.player1.leader.deployed).toBe(true);
    expect(raw.player1.leader.deployedPlayId).toBe("L1");
  });

  it("uses L2 for player 2 so the two sides cannot collide", () => {
    const raw = toRaw(builderState(
      player(),
      player({
        leaderCardId: "JTL_012",
        spaceUnits: [{ cardId: "SOR_193", ready: true, damage: 0, upgrades: [{ cardId: "JTL_012" }], captives: [] }],
      }),
    )) as unknown as { player2: RawSide };

    expect(raw.player2.spaceArena[0].upgrades[0].playId).toBe("L2");
    expect(raw.player2.leader.deployedPlayId).toBe("L2");
  });

  it("leaves a non-leader upgrade on the auto-assigned placeholder", () => {
    const raw = toRaw(builderState(
      player({ groundUnits: [{ cardId: "SOR_051", ready: true, damage: 0, upgrades: [{ cardId: "SOR_120" }], captives: [] }] }),
      player(),
    )) as unknown as { player1: RawSide };

    expect(raw.player1.groundArena[0].upgrades[0].playId).toBe("@");
    expect(raw.player1.leader.deployed).toBe(false);
  });
});
