import { describe, it, expect, beforeEach } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { RestoreAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/restore";
import { Cards } from "../../card-helpers";

// IBH keyword-only reprints. Each named card has several identical printings — every printing ID
// must carry the keyword (and, for Raid/Restore, the correct amount).

function baseGame() {
  new GameTestAdapter().loadNewState(
    new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .Build(),
  );
}

describe("IBH Sentinel reprints", () => {
  beforeEach(baseGame);

  const sentinelIds = [
    Cards.units.ibh.chewbacca, Cards.units.ibh.chewbaccaB,
    Cards.units.ibh.brightHope, Cards.units.ibh.brightHopeB,
    Cards.units.ibh.blizzardForceAtst, Cards.units.ibh.blizzardForceAtstB, Cards.units.ibh.blizzardForceAtstC,
    Cards.units.ibh.deathSquadronStarDestroyer, Cards.units.ibh.deathSquadronStarDestroyerB,
  ];

  it.each(sentinelIds)("%s has Sentinel", (id) => {
    expect(HasSentinel(id)).toBe(true);
  });
});

describe("IBH Raid reprints — correct amount on every printing", () => {
  beforeEach(baseGame);

  const raidCases: [string, number][] = [
    [Cards.units.ibh.rogueSquadronSpeeder, 1], [Cards.units.ibh.rogueSquadronSpeederB, 1], [Cards.units.ibh.rogueSquadronSpeederC, 1],
    [Cards.units.ibh.ewebGunner, 4], [Cards.units.ibh.ewebGunnerB, 4],
    [Cards.units.ibh.surfaceAssaultBomber, 1], [Cards.units.ibh.surfaceAssaultBomberB, 1], [Cards.units.ibh.surfaceAssaultBomberC, 1],
    [Cards.units.ibh.hanSolo, 2], [Cards.units.ibh.hanSoloB, 2],
  ];

  it.each(raidCases)("%s has Raid %i", (id, amount) => {
    expect(RaidAmount(id)).toBe(amount);
  });
});

describe("IBH Restore reprints", () => {
  beforeEach(baseGame);

  const restoreIds = [
    Cards.units.ibh.lambdaShuttle, Cards.units.ibh.lambdaShuttleB, Cards.units.ibh.lambdaShuttleC,
  ];

  it.each(restoreIds)("%s has Restore 1", (id) => {
    expect(RestoreAmount(id)).toBe(1);
  });
});

describe("IBH keyword behaviour", () => {
  it("E-Web Gunner deals its printed power + Raid 4 while attacking (unregistered would be printed only)", async () => {
    // E-Web Gunner (IBH_069): 0-power Trooper with Raid 4. Attacking the base deals 0 + 4 = 4.
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP)
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithGroundUnitForPlayer(1, Cards.units.ibh.ewebGunner)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4); // Raid 4 on a 0-power body
  });

  it("Lambda Shuttle heals 1 from your base when it attacks (Restore 1)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      new GameStateBuilder()
        .MyBase(Cards.bases.common.green30HP, 5) // 5 damage to heal from
        .MyLeader(Cards.leaders.sor.sabineWren)
        .TheirBase(Cards.bases.common.green30HP)
        .TheirLeader(Cards.leaders.sor.sabineWren)
        .WithSpaceUnitForPlayer(1, Cards.units.ibh.lambdaShuttle)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player1.base.damage).toBe(4); // 5 - 1 restored
  });
});
