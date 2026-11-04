import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// IC27_024 Grand Admiral Thrawn — Listen to Me Carefully (4/4 Ground, cost 6, Vigilance/Villainy)
//   "When Played/On Attack/When Defeated: You may give an Experience token to another friendly
//    unit. It gains Sentinel for this phase."
// One optional choice per trigger; the Sentinel goes to the unit that took the token.

const THRAWN = Cards.units.ic27.grandAdmiralThrawn;
const MARINE = Cards.units.sor.battlefieldMarine;
const XP = Cards.upgrades.token.experience;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.grandMoffTarkin)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

const offered = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Target" ? res.fromPlayIds : undefined;
};
const marineOf = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === MARINE)!;
const xpOn = (g: GameTestAdapter) => marineOf(g).upgrades.filter(u => u.cardId === XP).length;

describe("IC27_024 Grand Admiral Thrawn — When Played", () => {
  it("may give another friendly unit an Experience token, and it gains Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, THRAWN).Build());
    const marine = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    expect(offered(g)).toEqual([marine]); // Thrawn himself is not "another"
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(xpOn(g)).toBe(1);
    expect(HasSentinel(MARINE, marine, 1)).toBe(true);
  });

  it("declining gives nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, THRAWN).Build());
    const marine = g.state.player1.groundArena[0].playId;

    await g.playCardFromHandAsync(1, 0);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(xpOn(g)).toBe(0);
    expect(HasSentinel(MARINE, marine, 1)).toBe(false);
  });

  it("control: with no other friendly unit there is no prompt", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, THRAWN).Build());

    await g.playCardFromHandAsync(1, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy();
    expect(g.state.player1.groundArena[0].upgrades).toHaveLength(0);
  });
});

describe("IC27_024 Grand Admiral Thrawn — On Attack", () => {
  it("gives the token and Sentinel, then the attack lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, THRAWN).WithGroundUnitForPlayer(1, MARINE).Build());
    const marine = g.state.player1.groundArena[1].playId;

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(xpOn(g)).toBe(1);
    expect(HasSentinel(MARINE, marine, 1)).toBe(true);
    expect(g.state.player2.base.damage).toBe(4);
  });
});

describe("IC27_024 Grand Admiral Thrawn — When Defeated", () => {
  it("gives the token and Sentinel after he leaves play", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board()
        .WithGroundUnitForPlayer(1, THRAWN)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, Cards.events.twi.lethalCrackdown)
        .Build(),
    );
    const thrawn = g.state.player1.groundArena[0].playId;
    const marine = g.state.player1.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [thrawn] });
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(1);
    expect(offered(g)).toEqual([marine]);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [marine] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(xpOn(g)).toBe(1);
    expect(HasSentinel(MARINE, marine, 1)).toBe(true);
  });
});
