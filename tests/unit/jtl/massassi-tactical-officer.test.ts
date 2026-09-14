import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// JTL_146 Massassi Tactical Officer (-/4 Ground, cost 1, Rebel, Aggression/Heroism)
//   "Action [Exhaust]: Attack with a Fighter unit. It gets +2/+0 for this attack."

const OFFICER = Cards.units.jtl.massassiTacticalOfficer;
const AWING = Cards.units.jtl.phoenixSquadronAWing; // 3/2 Space Fighter

function setup() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.red30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .WithGroundUnitForPlayer(1, OFFICER);
}

describe("JTL_146 Massassi Tactical Officer", () => {
  it("a Fighter attacks with +2/+0 and the Officer exhausts", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithSpaceUnitForPlayer(1, AWING).Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "use-ability", { cardId: OFFICER, playId: s.player1.groundArena[0].playId });
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" && res.fromPlayIds).toEqual([s.player1.spaceArena[0].playId]);

    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // A-Wing 3 + 2
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(g.state.player1.spaceArena[0].ready).toBe(false);
  });

  it("the +2/+0 lasts only for that attack", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithSpaceUnitForPlayer(1, AWING).Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "use-ability", { cardId: OFFICER, playId: s.player1.groundArena[0].playId });
    await g.chooseSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    const awing = g.state.player1.spaceArena[0];
    expect(g.state.currentEffects.some(e => e.targetPlayId === awing.playId && e.cardId === OFFICER)).toBe(false);
  });

  it("only offers ready Fighter units — non-Fighters and exhausted Fighters are excluded", async () => {
    const g = new GameTestAdapter();
    const s = setup()
      .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine) // not a Fighter
      .WithSpaceUnitForPlayer(1, Cards.units.jtl.landingShuttle)     // Transport, not a Fighter
      .WithSpaceUnitForPlayer(1, AWING, false)                       // exhausted Fighter
      .WithSpaceUnitForPlayer(1, Cards.units.token.xWing)            // ready Fighter token
      .Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "use-ability", { cardId: OFFICER, playId: s.player1.groundArena[0].playId });

    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type === "Target" && res.fromPlayIds).toEqual([s.player1.spaceArena[2].playId]);
  });

  it("control: with no ready Fighter the ability isn't available and the Officer stays ready", async () => {
    const g = new GameTestAdapter();
    const s = setup().WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine).Build();
    g.loadNewState(s);

    await g.dispatchAsync(1, "use-ability", { cardId: OFFICER, playId: s.player1.groundArena[0].playId });

    expect(g.state.player1.groundArena[0].ready).toBe(true);
    expect(g.state.player2.base.damage).toBe(0);
  });
});
