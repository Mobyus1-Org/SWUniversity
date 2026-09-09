import { describe, it, expect } from "vitest";

import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";
import { GameStateBuilder } from "@/server/engine/game-state-builder";

import { Cards } from "../../card-helpers";
import { GameTestAdapter } from "../game-test-adapter";

//   ASH_031 Hera Syndulla — "When Attack Ends: If this unit dealt combat damage to a base, heal
//                            THAT MUCH damage from your base."
//   ASH_127 The Twins     — optional Sentinel grant on Played/Attack; heal 1 when ANOTHER friendly
//                            unit is defeated
//   ASH_161 Zeb Orrelios  — 3 Advantage tokens when played; 1 damage to a base when a friendly
//                            UPGRADE is defeated
//   ASH_123 Lang          — Action [Exhaust]: deal damage equal to his power to a ground unit

const HERA = Cards.units.ash.heraSyndullaRenegadeGeneral;   // 3/4
const TWINS = Cards.units.ash.theTwins;                     // 2/7
const ZEB = Cards.units.ash.zebOrrelios;                    // 5/7
const LANG = Cards.units.ash.lang;                          // 2/5
const ADVANTAGE = Cards.upgrades.token.advantage;
const SABER = Cards.upgrades.sor.academyTraining;
const MARINE = Cards.units.sor.battlefieldMarine;           // 3/3
const SECURITY = Cards.units.sor.consularSecurityForce;     // 3/7

function base(myDamage = 8) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP, myDamage)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 20)
    .FillResourcesForPlayer(2, MARINE, 20);
}

const at = (g: GameTestAdapter, p: 1 | 2, cardId: string) => {
  const st = p === 1 ? g.state.player1 : g.state.player2;
  return [...st.groundArena, ...st.spaceArena].find(u => u.cardId === cardId)!;
};

describe("ASH_031 Hera Syndulla — Renegade General", () => {
  it("heals your base by the combat damage she dealt to a base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(8).WithGroundUnitForPlayer(1, HERA).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(5); // 8 - 3
  });

  it("heals nothing when she attacks a UNIT instead", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(8).WithGroundUnitForPlayer(1, HERA).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY).playId] });

    expect(g.state.player1.base.damage).toBe(8);
  });

  it("does not heal off ANOTHER unit's base attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base(8).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, HERA).Build());

    await g.attackWithGroundUnitAsync(1, 0); // the Marine attacks
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player1.base.damage).toBe(8);
  });
});

describe("ASH_127 The Twins — We Don't Want War", () => {
  it("optionally gives another friendly unit Sentinel for the phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, TWINS).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, MARINE).playId] });

    const m = at(g, 1, MARINE);
    expect(HasSentinel(MARINE, m.playId, 1)).toBe(true);
  });

  it("is optional, and cannot pick itself", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, TWINS).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    expect(res?.type).toBe("Option");
    await g.chooseNoAsync(1);

    expect(HasSentinel(MARINE, at(g, 1, MARINE).playId, 1)).toBe(false);
  });

  it("heals 1 from your base when ANOTHER friendly unit is defeated", async () => {
    // Measured against the identical board WITHOUT the Twins, so the assertion is the 1 point of
    // healing itself rather than an absolute total.
    async function runWith(twins: boolean): Promise<number> {
      const g = new GameTestAdapter();
      let b = base(8).WithActivePlayer(2);
      if (twins) b = b.WithGroundUnitForPlayer(1, TWINS);
      g.loadNewState(
        b.WithGroundUnitForPlayer(1, MARINE)                 // 3/3, dies to the Wampa
         .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)  // 4/5
         .Build(),
      );
      const marine = at(g, 1, MARINE).playId;
      await g.attackWithGroundUnitAsync(2, 0);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [marine] });
      expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);
      return g.state.player1.base.damage;
    }

    const without = await runWith(false);
    const withTwins = await runWith(true);

    expect(without - withTwins).toBe(1);
  });

  it("does not heal off an ENEMY unit dying", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(8)
        .WithGroundUnitForPlayer(1, TWINS)
        .WithGroundUnitForPlayer(1, Cards.units.sor.wampa)
        .WithGroundUnitForPlayer(2, MARINE)
        .Build(),
    );

    await g.attackWithGroundUnitAsync(1, 1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, MARINE).playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player1.base.damage).toBe(8);
  });
});

describe("ASH_161 Zeb Orrelios — Fists Work Every Time", () => {
  it("gives 3 Advantage tokens to another chosen unit when played", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithCardInHandForPlayer(1, ZEB).WithGroundUnitForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 1, MARINE).playId] });

    expect(at(g, 1, MARINE).upgrades.filter(u => u.cardId === ADVANTAGE)).toHaveLength(3);
  });

  it("deals 1 to the enemy base when a friendly upgrade is defeated", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base(0)
        .WithActivePlayer(2)
        .WithGroundUnitForPlayer(1, ZEB)
        .WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 1, [GameStateBuilder.Upgrade(SABER, 1)])
        .WithGroundUnitForPlayer(2, Cards.units.sor.wampa)
        .Build(),
    );

    // The Marine (3/3 + Academy Training = 5/5) dies to the Wampa? No — give it lethal help.
    at(g, 1, MARINE).damage = 4;
    await g.attackWithGroundUnitAsync(2, 0);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [at(g, 1, MARINE).playId] });

    expect(g.state.player1.groundArena.some(u => u.cardId === MARINE)).toBe(false);
    expect(g.state.player2.base.damage).toBe(1);
  });
});

describe("ASH_123 Lang — Arrogant Mercenary", () => {
  it("deals damage equal to his power to the chosen ground unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(base().WithGroundUnitForPlayer(1, LANG).WithGroundUnitForPlayer(2, SECURITY).Build());

    await g.dispatchAsync(1, "use-ability", { cardId: LANG, playId: at(g, 1, LANG).playId });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [at(g, 2, SECURITY).playId] });

    expect(at(g, 2, SECURITY).damage).toBe(2); // his printed power
    expect(at(g, 1, LANG).ready).toBe(false);  // the exhaust is the cost
  });

  it("cannot aim at a SPACE unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      base()
        .WithGroundUnitForPlayer(1, LANG)
        .WithGroundUnitForPlayer(2, SECURITY)
        .WithSpaceUnitForPlayer(2, "JTL_069")
        .Build(),
    );

    await g.dispatchAsync(1, "use-ability", { cardId: LANG, playId: at(g, 1, LANG).playId });
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const offered = res?.type === "Target" ? (res.fromPlayIds ?? []) : [];

    expect(offered).not.toContain(at(g, 2, "JTL_069").playId);
    expect(offered).toContain(at(g, 2, SECURITY).playId);
  });
});
