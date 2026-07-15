import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

// SHD_187 Lurking TIE Phantom (2/2 Space) —
// "Raid 2" + "This unit can't be captured, damaged, or defeated by enemy card abilities."
function baseSetup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 14);
}

describe("SHD_187 Lurking TIE Phantom", () => {
  it("has Raid 2", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(baseSetup().WithSpaceUnitForPlayer(1, Cards.units.shd.lurkingTiePhantom).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(4); // 2 power + Raid 2
    expect(HasKeyword(Cards.units.shd.lurkingTiePhantom, "Raid", g.state.player1.spaceArena[0].playId, 1)).toBe(true);
  });

  it("can't be damaged by an enemy card ability (Daring Raid)", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithSpaceUnitForPlayer(1, Cards.units.shd.lurkingTiePhantom)   // player 1's immune unit
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 4)
      .WithCardInHandForPlayer(2, Cards.events.shd.daringRaid)        // player 2's damage event
      .Build();
    g.loadNewState(s);
    const phantomPlayId = g.state.player1.spaceArena[0].playId;

    // Player 2 (the enemy) uses Daring Raid on the Phantom — prevented.
    await g.playCardFromHandAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [phantomPlayId] });

    expect(g.state.player1.spaceArena[0].damage).toBe(0);
  });

  it("CAN still take combat damage (combat is not a card ability)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      baseSetup()
        .WithSpaceUnitForPlayer(1, Cards.units.shd.lurkingTiePhantom)
        .WithSpaceUnitForPlayer(2, Cards.units.token.xWing) // 2/2 — trades with the Phantom
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    // The Phantom is a 2/2; combat with a 2/2 X-Wing defeats both. Immunity does not block combat.
    expect(g.state.player1.spaceArena).toHaveLength(0);
  });

  it("can't be defeated by an enemy card ability (Vanquish)", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithSpaceUnitForPlayer(1, Cards.units.shd.lurkingTiePhantom)
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 6)
      .WithCardInHandForPlayer(2, Cards.events.sor.vanquish)   // "Defeat a non-leader unit"
      .WithGroundUnitForPlayer(2, Cards.units.sor.battlefieldMarine) // another legal target so Vanquish resolves
      .Build();
    g.loadNewState(s);
    const phantomPlayId = g.state.player1.spaceArena[0].playId;

    const played = await g.playCardFromHandAsync(2, 0); // player 2 casts Vanquish
    const resolution = played.lastDispatchResponse?.resolutionNeeded;
    const offered = resolution?.type === "Target" ? resolution.fromPlayIds ?? [] : [];

    expect(offered).not.toContain(phantomPlayId); // the Phantom is not a legal Vanquish target
  });

  it("can't be captured by an enemy card ability (Take Captive)", async () => {
    const g = new GameTestAdapter();
    const s = baseSetup()
      .WithSpaceUnitForPlayer(1, Cards.units.shd.lurkingTiePhantom)   // player 1's immune space unit
      .FillResourcesForPlayer(2, Cards.units.sor.battlefieldMarine, 6)
      .WithSpaceUnitForPlayer(2, Cards.units.token.xWing)            // player 2's space captor
      .WithCardInHandForPlayer(2, Cards.events.twi.takeCaptive)
      .Build();
    g.loadNewState(s);
    const phantomPlayId = g.state.player1.spaceArena[0].playId;

    await g.playCardFromHandAsync(2, 0);            // Take Captive
    await g.chooseSpaceUnitAsync(2, 0);             // choose the X-Wing captor

    // The only enemy space unit is the immune Phantom, so it is not captured — it stays in play.
    expect(g.state.player1.spaceArena.some(u => u.playId === phantomPlayId)).toBe(true);
    expect(g.state.player2.spaceArena[0].captives ?? []).toHaveLength(0);
  });
});
