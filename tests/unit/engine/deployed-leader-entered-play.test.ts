import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { NeedsTarget } from "@/lib/engine/message-types";

// Deploying a leader is the leader unit ENTERING PLAY (reason "deployed"). Hidden on a leader unit
// reads "This unit can't be attacked if she was deployed this phase", and it, Boba Fett's "didn't
// enter play this round" and The Armorer's "a unit that entered play this phase" all read the
// cardsEnteredPlayThisPhase ledger — so a deploy that never wrote to it left Hidden inert on every
// leader unit that has it (HMW_011 Darth Sidious, HMW_002 Maz Kanata).

const SIDIOUS = Cards.leaders.hmw.darthSidious;  // Hidden when deployed; 6-resource Epic Action
const WARRIOR = Cards.leaders.hmw.theWarrior;    // no Hidden; 5-resource Epic Action
const MARINE = Cards.units.sor.battlefieldMarine;

function setup(leader: string) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 8)
    .WithGroundUnitForPlayer(1, MARINE)  // always attackable, so P2's attack has a unit target
    .WithGroundUnitForPlayer(2, MARINE)  // the attacker
    .WithActivePlayer(1);
}

const leaderPlayId = (g: GameTestAdapter, cardId: string) =>
  g.state.player1.groundArena.find(u => u.cardId === cardId)!.playId;

describe("Deployed leaders enter play", () => {
  it("records the deploy in the entered-play ledger with reason 'deployed'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(SIDIOUS).Build());

    await g.deployLeaderAsync(1);

    const entry = g.state.roundState.cardsEnteredPlayThisPhase.find(e => e.cardId === SIDIOUS);
    expect(entry?.reason).toBe("deployed");
    expect(entry?.playId).toBe(leaderPlayId(g, SIDIOUS));
  });

  it("a Hidden leader unit can't be attacked the phase it was deployed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(SIDIOUS).Build());

    await g.deployLeaderAsync(1);
    await g.attackWithGroundUnitAsync(2, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds).not.toContain(leaderPlayId(g, SIDIOUS));
    expect(target.fromPlayIds).toHaveLength(1); // just the Marine
  });

  it("control: a deployed leader WITHOUT Hidden is attackable the same phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup(WARRIOR).Build());

    await g.deployLeaderAsync(1);
    await g.attackWithGroundUnitAsync(2, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds).toContain(leaderPlayId(g, WARRIOR));
  });

  it("control: a Hidden leader unit deployed in an earlier phase is attackable", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup(SIDIOUS)
        .MyLeader(SIDIOUS, true, true, true)
        .WithGroundUnitForPlayer(1, SIDIOUS)
        .WithActivePlayer(2)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(2, 0);

    const target = g.lastDispatchResponse!.resolutionNeeded as NeedsTarget;
    expect(target.fromPlayIds).toContain(leaderPlayId(g, SIDIOUS));
  });
});
