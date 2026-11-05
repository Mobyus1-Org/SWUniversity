import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// A unit that had lost its abilities when it was defeated has no When Defeated. HK-87 (LOF_235,
// "When Defeated: Deal 2 damage to each ground unit") is defeated by Lethal Crackdown while under
// SOR_138 Force Lightning's "loses all abilities for this phase".

const HK87 = Cards.units.lof.hk87AssassinDroid;
const MARINE = Cards.units.sor.battlefieldMarine;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithGroundUnitForPlayer(1, HK87)
    .WithGroundUnitForPlayer(2, MARINE)
    .WithCardInHandForPlayer(1, Cards.events.twi.lethalCrackdown);
}

async function defeatHk(g: GameTestAdapter) {
  await g.playCardFromHandAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
}

describe("When Defeated of a unit that lost its abilities", () => {
  it("does not fire", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());
    g.state.currentEffects.push({ cardId: "SOR_138", duration: "Phase", affectedPlayer: 1, targetPlayId: g.state.player1.groundArena[0].playId });

    await defeatHk(g);

    expect(g.state.player1.groundArena).toHaveLength(0);
    expect(g.state.player2.groundArena[0].damage).toBe(0);
  });

  it("control: with its abilities, the blast fires", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().Build());

    await defeatHk(g);

    expect(g.state.player2.groundArena[0].damage).toBe(2);
  });
});
