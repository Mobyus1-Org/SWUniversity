import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { HasSentinel } from "@/server/engine/card-db/keyword-dictionaries.ts/sentinel";

// SEC_038 Condemn (Upgrade, cost 3, Vigilance/Villainy)
//   "While attached unit is attacking, it gains: 'On Attack: The defending player may disclose
//    [Vigilance, Villainy]. If they do, this unit gets –6/–0 for this attack' and loses all other
//    abilities."
// Rulings: the blanking starts once the attack target is declared (Saboteur still gets it past a
// Sentinel, but no longer defeats Shields), covers abilities granted for this attack (it can't gain
// any), and lasts until the attack ends. Each Condemn grants its own disclose.

const CONDEMN = Cards.upgrades.sec.condemn;
const TURTLE = Cards.units.ash.dinosaurTurtle;     // 7/7, no abilities
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3
const WAMPA = Cards.units.sor.wampa;               // 4/5 Overwhelm
const EWEB = Cards.units.ibh.ewebGunner;           // 0/4 Raid 4
const GUARD = Cards.units.sor.cellBlockGuard;      // 3/3 Sentinel
const HK87 = Cards.units.lof.hk87AssassinDroid;    // 4/4 — When Defeated: 2 to each ground unit
const JARJAR = Cards.units.ic27.jarJarBinks;       // On Attack: discard top; cost 6+ gives +4/+0
const DISCLOSER = Cards.units.sor.deathTrooper;    // Vigilance + Villainy, in P2's hand
const SHIELD = Cards.upgrades.token.shield;

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14);
}

/** P1's unit at `index` wearing `copies` Condemns, played by the opponent. */
function condemned(b: GameStateBuilder, cardId: string, copies = 1) {
  return b.WithGroundUnitForPlayer(1, cardId)
    .WithUpgradesOnGroundUnitForPlayer(1, 0, Array.from({ length: copies }, () => GameStateBuilder.Upgrade(CONDEMN, 2)));
}

const discloseOffer = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Option" && /Disclose/.test(res.helperText ?? "") ? res : undefined;
};

async function attackBase(g: GameTestAdapter, index = 0) {
  await g.attackWithGroundUnitAsync(1, index);
  await g.chooseBaseAsync(1, 2);
}

describe("SEC_038 Condemn — the granted disclose", () => {
  it("the defending player discloses: –6/–0 for this attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), TURTLE).WithCardInHandForPlayer(2, DISCLOSER).Build());

    await attackBase(g);
    expect(discloseOffer(g)).toBeTruthy();
    await g.chooseYesAsync(2); // the DEFENDING player answers

    expect(g.state.player2.base.damage).toBe(1);
  });

  it("the defending player declines: full damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), TURTLE).WithCardInHandForPlayer(2, DISCLOSER).Build());

    await attackBase(g);
    expect(discloseOffer(g)).toBeTruthy();
    await g.chooseNoAsync(2);

    expect(g.state.player2.base.damage).toBe(7);
  });

  it("not offered when the defending player can't disclose both aspects", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), TURTLE).WithCardInHandForPlayer(2, GUARD).Build()); // Villainy only

    await attackBase(g);

    expect(discloseOffer(g)).toBeUndefined();
    expect(g.state.player2.base.damage).toBe(7);
  });

  it("two Condemns grant two discloses: –12/–0", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), TURTLE, 2).WithCardInHandForPlayer(2, DISCLOSER).Build());

    await attackBase(g);
    await g.chooseYesAsync(2);
    expect(discloseOffer(g)).toBeTruthy();
    await g.chooseYesAsync(2);

    expect(g.state.player2.base.damage).toBe(0);
  });
});

describe("SEC_038 Condemn — loses all other abilities while attacking", () => {
  it("its own Raid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), EWEB).Build());

    await attackBase(g);

    expect(g.state.player2.base.damage).toBe(0); // not 4
  });

  it("its own Overwhelm", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), WAMPA).WithGroundUnitForPlayer(2, MARINE).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player2.groundArena).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(0); // the 1 excess does not spill
  });

  it("its own On Attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), JARJAR).WithCardInDeckForPlayer(1, TURTLE).Build());

    await attackBase(g);

    expect(g.state.player1.deck).toHaveLength(1); // Jar Jar discarded nothing
    expect(g.state.player2.base.damage).toBe(1);
  });

  it("an On Attack granted by another upgrade", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board().WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [
          GameStateBuilder.Upgrade(CONDEMN, 2),
          GameStateBuilder.Upgrade(Cards.upgrades.shd.inspiringMentor, 1),
        ])
        .WithGroundUnitForPlayer(1, WAMPA).Build(),
    );

    await attackBase(g);

    expect(g.lastDispatchResponse?.resolutionNeeded).toBeFalsy(); // no Experience prompt
    expect(g.state.player1.groundArena[1].upgrades).toHaveLength(0);
  });

  it("an ability granted for this attack — Precision Fire's Saboteur no longer defeats Shields", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      condemned(board(), MARINE).WithCardInHandForPlayer(1, Cards.events.sor.precisionFire)
        .WithGroundUnitForPlayer(2, WAMPA)
        .WithUpgradesOnGroundUnitForPlayer(2, 0, [GameStateBuilder.Upgrade(SHIELD, 2)]).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    const wampa = g.state.player2.groundArena[0];
    expect(wampa.upgrades.map(u => u.cardId)).toEqual([]); // the Shield took the hit instead
    expect(wampa.damage).toBe(0);
  });

  it("Saboteur still gets it past a Sentinel — that is decided as the target is declared", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      condemned(board(), MARINE).WithCardInHandForPlayer(1, Cards.events.sor.precisionFire)
        .WithGroundUnitForPlayer(2, GUARD).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);

    expect(g.state.player2.base.damage).toBe(5); // Precision Fire's Trooper +2/+0 is a stat change, not an ability
  });

  it("its When Defeated, if it dies during the attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), HK87).WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, WAMPA).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]); // HK-87 died
    expect(g.state.player1.groundArena[0].damage).toBe(0); // no blast
    expect(g.state.player2.groundArena[0].damage).toBe(4); // combat only
  });

  it("not while it isn't attacking: a Condemned Sentinel keeps Sentinel, and has it again after", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemned(board(), GUARD).Build());
    const guard = g.state.player1.groundArena[0].playId;
    expect(HasSentinel(GUARD, guard, 1)).toBe(true);

    await attackBase(g);

    expect(g.state.player2.base.damage).toBe(3);
    expect(HasSentinel(GUARD, guard, 1)).toBe(true);
  });
});
