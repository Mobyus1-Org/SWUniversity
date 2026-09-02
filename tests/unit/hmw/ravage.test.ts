import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { Unit } from "@/server/engine/unit";

// HMW_071 Ravage (Event, cost 4, Vigilance/Villainy, Disaster/Tactic) —
//   "Distribute up to 3 Weakness tokens among any number of units."
//
// The engine already had a spread-tokens prompt, but it granted ADVANTAGE tokens unconditionally,
// so Ravage needed it generalised to carry which token it hands out.
//
// "Up to 3" is the other half: the existing spread prompts demand all-or-nothing (0 or exactly N).
// "Up to" explicitly permits 1 or 2, so this needed a partial-distribution mode — an all-or-nothing
// implementation would look right in the 3-token test and reject a legal 1-token play.
//
// Weakness is −1/−1 and is the only upgrade that lowers HP, so a distribution can be lethal and
// must be swept.

const RAVAGE = "HMW_071";
const WEAKNESS = "HMW_T02";
const MARINE = Cards.units.sor.battlefieldMarine;   // 3/3
const CSF = Cards.units.sor.consularSecurityForce;  // 3/7

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.blue30HP)
    .MyLeader(Cards.leaders.sor.directorKrennic)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, MARINE, 14)
    .WithCardInHandForPlayer(1, RAVAGE)
    .WithActivePlayer(1);
}

const tokens = (u: { upgrades: { cardId: string }[] }) =>
  u.upgrades.filter(x => x.cardId === WEAKNESS).length;

describe("HMW_071 Ravage", () => {
  it("puts all 3 tokens on one unit when asked", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: victim, damage: 3 }],
    });

    const u = g.state.player2.groundArena[0];
    expect(tokens(u)).toBe(3);
    expect(Unit.FromInterface(u).CurrentPower()).toBe(0); // 3 - 3
    expect(Unit.FromInterface(u).TotalHP()).toBe(4);      // 7 - 3
  });

  it("spreads across several units", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      setup()
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(2, CSF)
        .WithGroundUnitForPlayer(1, CSF)
        .Build(),
    );
    const a = g.state.player2.groundArena[0].playId;
    const b = g.state.player2.groundArena[1].playId;
    const c = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [
        { playId: a, damage: 1 },
        { playId: b, damage: 1 },
        { playId: c, damage: 1 },
      ],
    });

    expect(tokens(g.state.player2.groundArena[0])).toBe(1);
    expect(tokens(g.state.player2.groundArena[1])).toBe(1);
    expect(tokens(g.state.player1.groundArena[0])).toBe(1); // friendly units are legal too
  });

  it("accepts a PARTIAL distribution — the text says 'up to 3'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: victim, damage: 1 }],
    });

    expect(tokens(g.state.player2.groundArena[0])).toBe(1);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull(); // accepted, not re-asked
  });

  it("accepts distributing none at all", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { spreadDamageAssignments: [] });

    expect(tokens(g.state.player2.groundArena[0])).toBe(0);
    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });

  it("rejects more than 3 tokens", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: victim, damage: 4 }],
    });

    expect(tokens(g.state.player2.groundArena[0])).toBe(0); // nothing applied
  });

  it("a lethal pile of tokens defeats the unit and sweeps it", async () => {
    // A 3/3 Marine taking 3 Weakness tokens becomes 0/0.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, MARINE).Build());
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: victim, damage: 3 }],
    });

    expect(g.state.player2.groundArena).toHaveLength(0);
  });

  it("hands out WEAKNESS tokens, not Advantage", async () => {
    // The shared spread-tokens prompt granted Advantage before this card existed.
    const g = new GameTestAdapter();
    g.loadNewState(setup().WithGroundUnitForPlayer(2, CSF).Build());
    const victim = g.state.player2.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: victim, damage: 2 }],
    });

    const upgrades = g.state.player2.groundArena[0].upgrades.map(u => u.cardId);
    expect(upgrades).toEqual([WEAKNESS, WEAKNESS]);
  });

  it("does nothing with no units on the board", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
  });
});
