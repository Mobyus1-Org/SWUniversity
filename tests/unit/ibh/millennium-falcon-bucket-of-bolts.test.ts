import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// IBH_031 Millennium Falcon — Bucket of Bolts (Unit 5/6 Space, cost 7, Cunning/Heroism)
//   "When Played: If your base has more damage on it than an enemy base, ready this unit."

const FALCON = Cards.units.ibh.millenniumFalconBucketOfBolts;

function setup(myDamage: number, theirDamage: number) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, myDamage)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP, theirDamage)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 20)
    .WithCardInHandForPlayer(1, FALCON);
}

async function playFalcon(myDamage: number, theirDamage: number) {
  const g = new GameTestAdapter();
  g.loadNewState(setup(myDamage, theirDamage).Build());
  await g.playCardFromHandAsync(1, 0);
  return g.state.player1.spaceArena.find(u => u.cardId === FALCON)!;
}

describe("IBH_031 Millennium Falcon — Bucket of Bolts", () => {
  it("readies itself when your base has MORE damage than the enemy base", async () => {
    expect((await playFalcon(3, 1)).ready).toBe(true);
  });

  it("a tie is not 'more' — it stays exhausted", async () => {
    expect((await playFalcon(2, 2)).ready).toBe(false);
  });

  it("stays exhausted when your base has less damage", async () => {
    expect((await playFalcon(0, 5)).ready).toBe(false);
  });
});
