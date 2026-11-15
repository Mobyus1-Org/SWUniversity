import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SHD_035 Clan Saxon Gauntlet (4/5 Space, cost 6, Villainy/Vigilance)
//   "Sentinel"
//   "When this unit is attacked: You may give an Experience token to a unit (before damage is dealt)."
//
// Its controller answers, while the attack waits. "Before damage": a token on the Gauntlet itself
// raises its power for the counter-attack.

const GAUNTLET = Cards.units.shd.clanSaxonGauntlet;
const XWING = Cards.units.token.xWing; // 2/2 space
const XP = Cards.upgrades.token.experience;

const xp = (u: { upgrades: { cardId: string }[] }) => u.upgrades.filter(x => x.cardId === XP).length;

function setup() {
  // P1's X-Wing attacks P2's Gauntlet.
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.blue30HP)
    .TheirLeader(Cards.leaders.sor.idenVersio)
    .WithSpaceUnitForPlayer(1, XWING)
    .WithSpaceUnitForPlayer(2, GAUNTLET)
    .WithActivePlayer(1);
}

async function attackGauntlet(g: GameTestAdapter) {
  await g.attackWithSpaceUnitAsync(1, 0);
  await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });
}

describe("SHD_035 Clan Saxon Gauntlet", () => {
  it("has Sentinel", () => {
    expect(HasSentinel(GAUNTLET)).toBe(true);
  });

  it("when attacked: its controller may give an XP token, before damage — the counter-attack hits harder", async () => {
    const g = new GameTestAdapter();
    const state = setup().Build();
    state.player1.spaceArena[0].upgrades = [{ cardId: XP, playId: "900", owner: 1, controller: 1 }, { cardId: XP, playId: "901", owner: 1, controller: 1 }, { cardId: XP, playId: "902", owner: 1, controller: 1 }]; // X-Wing 5/5
    g.loadNewState(state);

    await attackGauntlet(g);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option");
    await g.chooseYesAsync(2);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [g.state.player2.spaceArena[0].playId] });

    expect(xp(g.state.player2.spaceArena[0])).toBe(1);
    // 4 + 1 power: the 5/5 X-Wing dies to the counter-attack; the Gauntlet (5/6 now) survives 5.
    expect(g.state.player1.spaceArena.length).toBe(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(5);
  });

  it("declined: no token, and the attack resolves", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(setup().Build());

    await attackGauntlet(g);
    await g.chooseNoAsync(2);

    expect(xp(g.state.player2.spaceArena[0])).toBe(0);
    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });
});
