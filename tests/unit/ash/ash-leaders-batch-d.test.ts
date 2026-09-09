import { describe, it, expect } from "vitest";

import { HasOverwhelm } from "@/server/engine/card-db/keyword-dictionaries.ts/overwhelm";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { HasShielded } from "@/server/engine/card-db/keyword-dictionaries.ts/shielded";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Unit } from "@/server/engine/unit";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   ASH_006 Sabine Wren — Bargaining on Belief
//   ASH_007 Grand Admiral Sloane — Holding the Empire Together
//   ASH_010 Bo-Katan Kryze — Reclaiming Mandalore
//   ASH_017 Greef Karga — Gracious Magistrate

const SABINE = Cards.leaders.ash.sabineWrenBargaining;
const SLOANE = Cards.leaders.ash.grandAdmiralSloane;
const BOKATAN = Cards.leaders.ash.boKatanKryzeReclaiming;
const GREEF = Cards.leaders.ash.greefKarga;
const ADVANTAGE = Cards.upgrades.token.advantage;
const MANDO_TOKEN = Cards.units.token.mandalorian;
const MARINE = Cards.units.sor.battlefieldMarine;
const SECURITY = Cards.units.sor.consularSecurityForce;
const FRIGATE = "JTL_069";                 // Space
const MANDALORIAN = Cards.units.ash.koskaReeves; // Mandalorian trait

function base(leader: string, resources = 20) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const at = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId);
};
const advantage = (g: GameTestAdapter, p: 1 | 2, cardId: string) =>
  at(g, p, cardId)?.upgrades.filter(u => u.cardId === ADVANTAGE).length ?? 0;

describe("ASH_006 Sabine Wren — Bargaining on Belief", () => {
  it("the opponent's unit takes 2 Advantage tokens and your next unit gains Shielded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(SABINE).WithGroundUnitForPlayer(2, SECURITY).WithCardInHandForPlayer(1, MARINE).Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: SABINE });
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [at(g, 2, SECURITY)!.playId] });
    expect(advantage(g, 2, SECURITY)).toBe(2);

    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    const played = at(g, 1, MARINE)!;
    expect(HasShielded(MARINE, played.playId, 1)).toBe(true);
  });

  it("only the FIRST unit played gains Shielded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(SABINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithCardInHandForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, SECURITY)
        .Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: SABINE });
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [at(g, 2, SECURITY)!.playId] });
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(HasShielded(SECURITY, at(g, 1, SECURITY)!.playId, 1)).toBe(false);
  });

  it("does nothing when the opponent controls no unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(SABINE).WithCardInHandForPlayer(1, MARINE).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: SABINE });

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(g.state.player1.leader.ready).toBe(false); // the exhaust was still paid
  });
});

describe("ASH_007 Grand Admiral Sloane — Holding the Empire Together", () => {
  it("gives every unit in the chosen arena Sentinel and Overwhelm, both players'", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(SLOANE)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithSpaceUnitForPlayer(1, FRIGATE)
        .Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: SLOANE });
    await g.chooseOptionAsync(1, "ground");

    const mine = at(g, 1, MARINE)!;
    const theirs = at(g, 2, SECURITY)!;
    expect(HasSentinel(MARINE, mine.playId, 1)).toBe(true);
    expect(HasOverwhelm(MARINE, mine.playId, 1, theirs.playId, 2)).toBe(true);
    expect(HasSentinel(SECURITY, theirs.playId, 2)).toBe(true);
    // The space arena was not chosen.
    expect(HasSentinel(FRIGATE, at(g, 1, FRIGATE)!.playId, 1)).toBe(false);
  });

  it("choosing space leaves the ground arena alone", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(SLOANE).WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, FRIGATE).Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: SLOANE });
    await g.chooseOptionAsync(1, "space");

    expect(HasSentinel(FRIGATE, at(g, 1, FRIGATE)!.playId, 1)).toBe(true);
    expect(HasSentinel(MARINE, at(g, 1, MARINE)!.playId, 1)).toBe(false);
  });

  it("deployed: each OTHER friendly unit gains Overwhelm and Sentinel", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(SLOANE).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, SECURITY).Build());
    await g.deployLeaderAsync(1);

    const mine = at(g, 1, MARINE)!;
    expect(HasSentinel(MARINE, mine.playId, 1)).toBe(true);
    expect(HasOverwhelm(MARINE, mine.playId, 1, at(g, 2, SECURITY)!.playId, 2)).toBe(true);
    // Not the opponent's units.
    expect(HasSentinel(SECURITY, at(g, 2, SECURITY)!.playId, 2)).toBe(false);
  });
});

describe("ASH_010 Bo-Katan Kryze — Reclaiming Mandalore", () => {
  it("creates a Mandalorian token when you hold a unit in each arena", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(BOKATAN).WithGroundUnitForPlayer(1, MARINE).WithSpaceUnitForPlayer(1, FRIGATE).Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: BOKATAN });

    expect(g.state.player1.groundArena.filter(u => u.cardId === MANDO_TOKEN)).toHaveLength(1);
  });

  it("creates nothing with only one arena occupied, and still charges the 2 resources", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BOKATAN).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: BOKATAN });

    expect(g.state.player1.groundArena.filter(u => u.cardId === MANDO_TOKEN)).toHaveLength(0);
    expect(g.state.player1.resources.filter(r => !r.ready).length).toBe(2);
  });

  it("deploys below 10 resources when friendly Mandalorians make up the difference", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BOKATAN, 8).WithGroundUnitForPlayer(1, MANDALORIAN).WithGroundUnitForPlayer(1, MANDALORIAN).Build());

    await g.deployLeaderAsync(1);

    expect(at(g, 1, BOKATAN)).toBeTruthy(); // 8 resources + 2 Mandalorians
  });

  it("does not deploy when resources plus Mandalorians fall short", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BOKATAN, 8).Build());

    await g.deployLeaderAsync(1);

    expect(at(g, 1, BOKATAN)).toBeUndefined();
  });

  it("deployed: other friendly Mandalorians get +1/+0, and she does not buff herself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(BOKATAN, 12).WithGroundUnitForPlayer(1, MANDALORIAN).Build());
    await g.deployLeaderAsync(1);

    const buffed = Unit.FromInterface(at(g, 1, MANDALORIAN)!);
    expect(buffed.CurrentPower()).toBe(5); // Koska is 4/4
    expect(buffed.TotalHP()).toBe(4);
    expect(Unit.FromInterface(at(g, 1, BOKATAN)!).CurrentPower()).toBe(4); // her printed power
  });
});

describe("ASH_017 Greef Karga — Gracious Magistrate", () => {
  it("front: exhausts to give an Advantage token to the unit you played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(GREEF).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);

    expect(advantage(g, 1, MARINE)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("front: is optional", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(GREEF).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(advantage(g, 1, MARINE)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("front: fires on CREATING a unit too", async () => {
    const g = new GameTestAdapter();
    // Children of the Watch makes 2 Mandalorian tokens on entry.
    g.loadNewState(base(GREEF).WithCardInHandForPlayer(1, Cards.units.ash.childrenOfTheWatch).Build());

    await g.playCardFromHandAsync(1, 0);
    // Several units arrive at once, so the engine first asks which reaction to resolve first;
    // answer that with a trigger label, and the Yes/No offers with Yes.
    let guard = 0;
    while (g.lastDispatchResponse?.resolutionNeeded?.type === "Option" && guard++ < 6) {
      const res = g.lastDispatchResponse.resolutionNeeded;
      const options = res.type === "Option" ? (res.options ?? []) : [];
      if (options.includes("Yes")) await g.chooseYesAsync(1);
      else await g.chooseOptionAsync(1, options[0]);
    }

    const tokens = g.state.player1.groundArena.filter(u => u.cardId === MANDO_TOKEN);
    const total = tokens.reduce((n, t) => n + t.upgrades.filter(u => u.cardId === ADVANTAGE).length, 0)
      + advantage(g, 1, Cards.units.ash.childrenOfTheWatch);
    expect(total).toBe(1); // exactly one, because the exhaust can only be paid once
    expect(g.state.player1.leader.ready).toBe(false);
  });

  it("does not fire when the OPPONENT plays a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(GREEF).WithActivePlayer(2).WithCardInHandForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(2, 0);

    expect(g.lastDispatchResponse?.resolutionNeeded ?? null).toBeNull();
    expect(advantage(g, 2, MARINE)).toBe(0);
  });

  it("does not fire on an UPGRADE", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(GREEF)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, Cards.upgrades.sor.academyTraining)
        .Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, MARINE)!.playId] });

    expect(advantage(g, 1, MARINE)).toBe(0);
    expect(g.state.player1.leader.ready).toBe(true);
  });

  it("deployed: gives a token to EACH unit, with no exhaust", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(GREEF)
        .WithCardInHandForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, SECURITY)
        .Build(),
    );
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(2, "pass-action", {});
    await g.playCardFromHandAsync(1, 0);

    expect(advantage(g, 1, MARINE)).toBe(1);
    expect(advantage(g, 1, SECURITY)).toBe(1);
  });
});
