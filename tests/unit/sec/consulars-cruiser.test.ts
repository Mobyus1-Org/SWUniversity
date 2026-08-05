import { describe, it, expect } from "vitest";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { GameTestAdapter } from "../game-test-adapter";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SEC_117 Consular's Cruiser (4/5 Space, cost 5, Command, Republic/Vehicle/Transport) —
//   "Sentinel (Enemy units in this arena must attack a Sentinel when they attack you.)"
// One clause, unconditional. A keyword that is registered but never READ is the real failure mode,
// so this tests the behaviour and not just the dictionary.
describe("SEC_117 Consular's Cruiser", () => {
  function base() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.leiaOrgana)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithActivePlayer(1);
  }

  it("has Sentinel", () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithSpaceUnitForPlayer(2, Cards.units.sec.consularsCruiser).Build());

    const cruiser = g.state.player2.spaceArena[0];
    expect(HasSentinel(cruiser.cardId, cruiser.playId, 2)).toBe(true);
  });

  it("enemy space units cannot attack past it — the other unit is an illegal target", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
      .WithSpaceUnitForPlayer(2, Cards.units.sec.consularsCruiser)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer) // hiding behind the Sentinel
      .Build();
    g.loadNewState(s);

    await g.attackWithSpaceUnitAsync(1, 0);
    const res = await g.dispatchAsync(1, "choose-target", {
      targetPlayIds: [s.player2.spaceArena[1].playId],
    });

    expect(res.lastDispatchResponse?.invalidAction).toBe(true);
  });

  it("the Sentinel itself is a legal target", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter) // 2 power
        .WithSpaceUnitForPlayer(2, Cards.units.sec.consularsCruiser)
        .Build(),
    );

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseSpaceUnitAsync(2, 0);

    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });

  it("it only guards its own arena — ground attacks are unaffected", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, Cards.units.sor.battlefieldMarine)
        .WithSpaceUnitForPlayer(2, Cards.units.sec.consularsCruiser)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
  });

  it("control: without the Cruiser, the hidden unit is attackable", async () => {
    const g = new GameTestAdapter();
    const s = base()
      .WithSpaceUnitForPlayer(1, Cards.units.sor.tieLnFighter)
      .WithSpaceUnitForPlayer(2, Cards.units.lof.hyperspaceWayfarer)
      .Build();
    g.loadNewState(s);

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [s.player2.spaceArena[0].playId] });

    expect(g.state.player2.spaceArena[0].damage).toBe(2);
  });
});
