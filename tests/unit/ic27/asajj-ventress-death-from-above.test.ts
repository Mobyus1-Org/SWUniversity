import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { POWER_MOD } from "@/lib/engine/core-models";
import { HasSaboteur } from "@/server/engine/card-db/keyword-dictionaries.ts/saboteur";

// IC27_147 Asajj Ventress — Death From Above (5/7 Ground, cost 6, Cunning/Villainy)
//   "If a friendly non-leader ground unit would deal combat damage while attacking a base, you may
//    reveal this unit from your hand and pay [5 resources Cunning Villainy]. If you do, return the
//    attacker to its owner's hand and put this unit into play as the attacker. She deals combat
//    damage to that base instead."
// Offered once, just before combat damage (after every On Attack). Rulings:
//   - What the ability that STARTED the attack put on the attacker moves to her (+N/+0 for this
//     attack, abilities granted for this attack, after-attack riders).
//   - What was applied during the attack (an On Attack's own buff, Condemn's –6/–0), phase buffs
//     and printed keywords (Raid) stay with the returned unit.
//   - One swap per attack. Uniqueness resolves before she deals damage.

const ASAJJ = Cards.units.ic27.asajjVentress;
const MARINE = Cards.units.sor.battlefieldMarine;  // 3/3
const WAMPA = Cards.units.sor.wampa;               // 4/5
const EWEB = Cards.units.ibh.ewebGunner;           // 0/4, Raid 4
const SPY = Cards.units.token.spy;                 // token, Raid 2
const TIE = Cards.units.sor.tieLnFighter;          // space
const TRAINING = Cards.upgrades.sor.academyTraining;
const CUNNING_VILLAINY_LEADER = Cards.leaders.ic27.asajjVentress; // covers both her aspects

const readyResources = (g: GameTestAdapter, p: 1 | 2 = 1) =>
  (p === 1 ? g.state.player1 : g.state.player2).resources.filter(r => r.ready).length;

function board(resources = 5, leader: string = CUNNING_VILLAINY_LEADER) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(leader)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.lukeSkywalker)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, resources);
}

const isOffer = (g: GameTestAdapter) => {
  const res = g.lastDispatchResponse?.resolutionNeeded;
  return res?.type === "Option" && /Asajj Ventress/.test(res.helperText ?? "");
};

async function attackBase(g: GameTestAdapter, index = 0) {
  await g.attackWithGroundUnitAsync(1, index);
  await g.chooseBaseAsync(1, 2);
}

describe("IC27_147 Asajj Ventress — Death From Above: the swap", () => {
  it("reveal and pay: the attacker returns to hand and Asajj deals her 5 to the base", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);
    expect(isOffer(g)).toBe(true);
    expect(g.state.player2.base.damage).toBe(0); // asked before any combat damage
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([ASAJJ]);
    expect(g.state.player1.groundArena[0].ready).toBe(false);
    expect(readyResources(g)).toBe(0);
  });

  it("declining is a normal attack", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);
    expect(isOffer(g)).toBe(true);
    await g.chooseNoAsync(1);

    expect(g.state.player2.base.damage).toBe(3);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([ASAJJ]);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(readyResources(g)).toBe(5);
  });

  it("she deals HER damage either way: a 1-power attacker becomes 5, a big one drops to 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, Cards.units.ic27.jarJarBinks).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g); // Jar Jar, 1 power, empty deck: no buff
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(5);
  });

  it("her damage can win the game", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());
    g.state.player2.base.damage = 25; // the Marine's 3 would leave 2

    await attackBase(g);
    await g.chooseYesAsync(1);

    expect(g.state.defeatedPlayers).toContain(2);
  });
});

describe("IC27_147 Asajj Ventress — when it is not offered", () => {
  it("attacking a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, WAMPA).WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player2.groundArena[0].playId] });

    expect(isOffer(g)).toBe(false);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([ASAJJ]);
  });

  it("a space attacker", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithSpaceUnitForPlayer(1, TIE).WithCardInHandForPlayer(1, ASAJJ).Build());

    await g.attackWithSpaceUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);

    expect(isOffer(g)).toBe(false);
    expect(g.state.player2.base.damage).toBe(2);
  });

  it("a deployed leader unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).WithCardInHandForPlayer(1, ASAJJ).Build());
    await g.deployLeaderAsync(1);
    await g.dispatchAsync(2, "pass-action", {});

    await attackBase(g);
    if (g.lastDispatchResponse?.resolutionNeeded?.type === "Option" && !isOffer(g)) await g.chooseNoAsync(1); // her own ready-a-resource

    expect(isOffer(g)).toBe(false);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([ASAJJ]);
  });

  it("she is not in hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInDiscardForPlayer(1, ASAJJ).Build());

    await attackBase(g);

    expect(isOffer(g)).toBe(false);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("the attack is the OPPONENT's — not friendly", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(2, MARINE).WithCardInHandForPlayer(1, ASAJJ).WithActivePlayer(2).Build());

    await g.attackWithGroundUnitAsync(2, 0);
    await g.chooseBaseAsync(2, 1);

    expect(isOffer(g)).toBe(false);
    expect(g.state.player1.base.damage).toBe(3);
  });

  it("one resource short", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(4).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);

    expect(isOffer(g)).toBe(false);
    expect(g.state.player2.base.damage).toBe(3);
  });

  it("the attacker would deal no combat damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());
    const marine = g.state.player1.groundArena[0].playId;
    g.state.currentEffects.push({ cardId: POWER_MOD, duration: "Phase", affectedPlayer: 1, targetPlayId: marine, value: -3 });

    await attackBase(g);

    expect(isOffer(g)).toBe(false);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
  });
});

describe("IC27_147 Asajj Ventress — cost", () => {
  it("off-aspect she costs 5 + 2 + 2 = 9, and all 9 are paid", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(9, Cards.leaders.sor.lukeSkywalker).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);
    expect(isOffer(g)).toBe(true);
    await g.chooseYesAsync(1);

    expect(readyResources(g)).toBe(0);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("off-aspect, 8 resources is not enough", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(8, Cards.leaders.sor.lukeSkywalker).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);

    expect(isOffer(g)).toBe(false);
  });
});

describe("IC27_147 Asajj Ventress — the returned attacker", () => {
  it("goes to its OWNER's hand", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());
    g.state.player1.groundArena[0].owner = 2; // stolen

    await attackBase(g);
    await g.chooseYesAsync(1);

    expect(g.state.player2.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.hand).toHaveLength(0);
  });

  it("a token is set aside, and its Raid stays with it", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, SPY).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);
    expect(isOffer(g)).toBe(true); // 0 power, but Raid 2 means it would deal 2
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand).toHaveLength(0);
    expect(g.state.player1.discard).toHaveLength(0);
    expect(g.state.player2.base.damage).toBe(5); // not 7
  });

  it("a printed Raid stays with the returned unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, EWEB).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(5); // not 9
  });

  it("its upgrades are discarded", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board().WithGroundUnitForPlayer(1, MARINE)
        .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(TRAINING, 1)])
        .WithCardInHandForPlayer(1, ASAJJ).Build(),
    );

    await attackBase(g);
    await g.chooseYesAsync(1);

    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(TRAINING);
    expect(g.state.player2.base.damage).toBe(5); // the +2/+2 went with the upgrade
  });
});

describe("IC27_147 Asajj Ventress — what follows her and what stays", () => {
  it("the attack-starting ability's +2/+0 and granted ability move to her (Heroic Sacrifice)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board(14).WithGroundUnitForPlayer(1, MARINE)
        .WithCardInHandForPlayer(1, Cards.events.sor.heroicSacrifice)
        .WithCardInHandForPlayer(1, ASAJJ)
        .WithCardInDeckForPlayer(1, WAMPA).Build(),
    );

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    expect(isOffer(g)).toBe(true);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(7);           // 5 + 2
    expect(g.state.player1.groundArena).toHaveLength(0);   // its "defeat it" went with the +2
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(ASAJJ);
  });

  it("the attacking leader's after-attack rider follows her (IC27_007 ready a resource)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(6).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());
    g.state.player1.resources[5].ready = false; // 5 ready + 1 exhausted

    await g.useLeaderAbilityAsync(1);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    expect(isOffer(g)).toBe(true);
    await g.chooseYesAsync(1); // pays the 5 ready
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Option"); // she survived: may ready one
    await g.chooseYesAsync(1);

    expect(readyResources(g)).toBe(1);
  });

  it("an On Attack's own buff stays with the attacker (Jar Jar's +4/+0)", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board().WithGroundUnitForPlayer(1, Cards.units.ic27.jarJarBinks)
        .WithCardInDeckForPlayer(1, Cards.units.ic27.grandAdmiralThrawn) // cost 6: Jar Jar gets +4/+0
        .WithCardInHandForPlayer(1, ASAJJ).Build(),
    );

    await attackBase(g);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(5); // not 9
  });

  it("a phase buff stays with the returned unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).Build());
    const marine = g.state.player1.groundArena[0].playId;
    g.state.currentEffects.push({ cardId: POWER_MOD, duration: "Phase", affectedPlayer: 1, targetPlayId: marine, value: 2 });

    await attackBase(g);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(5); // not 7
  });
});

describe("IC27_147 Asajj Ventress — one swap, uniqueness", () => {
  it("with two in hand there is one offer and one swap", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board(14).WithGroundUnitForPlayer(1, MARINE).WithCardInHandForPlayer(1, ASAJJ).WithCardInHandForPlayer(1, ASAJJ).Build());

    await attackBase(g);
    await g.chooseYesAsync(1);

    expect(isOffer(g)).toBe(false);
    expect(g.state.player2.base.damage).toBe(5);
    expect(g.state.player1.hand.map(c => c.cardId).sort()).toEqual([ASAJJ, MARINE].sort());
  });

  it("already controlling one: keep the NEW copy, and she deals the damage", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, ASAJJ).WithCardInHandForPlayer(1, ASAJJ).Build());
    const oldAsajj = g.state.player1.groundArena[1].playId;

    await attackBase(g);
    await g.chooseYesAsync(1);
    expect(g.lastDispatchResponse?.resolutionNeeded?.type).toBe("Target"); // uniqueness, before damage
    expect(g.state.player2.base.damage).toBe(0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oldAsajj] });

    expect(g.state.player1.groundArena.map(u => u.playId)).not.toContain(oldAsajj);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([ASAJJ]);
    expect(g.state.player2.base.damage).toBe(5);
  });

  it("already controlling one: keep the OLD copy, and the base takes nothing", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, ASAJJ).WithCardInHandForPlayer(1, ASAJJ).Build());
    const oldAsajj = g.state.player1.groundArena[1].playId;

    await attackBase(g);
    await g.chooseYesAsync(1);
    const res = g.lastDispatchResponse?.resolutionNeeded;
    const newAsajj = (res?.type === "Target" ? res.fromPlayIds ?? [] : []).find(id => id !== oldAsajj)!;
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [newAsajj] });

    expect(g.state.player1.groundArena.map(u => u.playId)).toEqual([oldAsajj]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([MARINE]);
    expect(g.state.player2.base.damage).toBe(0);
  });
});

describe("IC27_147 Asajj Ventress — Condemn and Commence the Festivities rulings", () => {
  const CONDEMN = Cards.upgrades.sec.condemn;
  const TURTLE = Cards.units.ash.dinosaurTurtle;    // 7/7
  const GUARD = Cards.units.sor.cellBlockGuard;     // Sentinel
  const DISCLOSER = Cards.units.sor.deathTrooper;   // Vigilance + Villainy, in P2's hand
  const COMMENCE = Cards.events.law.commenceTheFestivities;

  function condemnedAttacker(cardId: string, resources = 5) {
    return board(resources)
      .WithGroundUnitForPlayer(1, cardId)
      .WithUpgradesOnGroundUnitForPlayer(1, 0, [GameStateBuilder.Upgrade(CONDEMN, 2)])
      .WithCardInHandForPlayer(1, ASAJJ)
      .WithCardInHandForPlayer(2, DISCLOSER);
  }

  it("1. Condemn drops a 6-or-less attacker to 0: no swap — nothing paid or revealed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemnedAttacker(MARINE).Build());

    await attackBase(g);
    await g.chooseYesAsync(2); // P2 discloses: the Marine's 3 becomes 0

    expect(isOffer(g)).toBe(false);
    expect(g.state.player1.groundArena.map(u => u.cardId)).toEqual([MARINE]);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([ASAJJ]);
    expect(readyResources(g)).toBe(5);
    expect(g.state.player2.base.damage).toBe(0);
  });

  it("1. control: P2 declines to disclose, so the Marine keeps its 3 and the swap is offered", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemnedAttacker(MARINE).Build());

    await attackBase(g);
    await g.chooseNoAsync(2);
    expect(isOffer(g)).toBe(true);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(5);
  });

  it("2. Condemn leaves a 7+ attacker at 1+: the swap is offered and Asajj still deals 5", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(condemnedAttacker(TURTLE).Build());

    await attackBase(g);
    await g.chooseYesAsync(2); // the Turtle's 7 becomes 1
    expect(isOffer(g)).toBe(true);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(5); // the –6/–0 stayed with the Turtle
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([TURTLE]);
    expect(g.state.player2.discard.map(c => c.cardId)).toContain(CONDEMN); // its owner's discard
  });

  it("3. Commence the Festivities: past the Sentinel, and Asajj takes its +2/+0 — she deals 7", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board(8).FillResourcesForPlayer(2, MARINE, 10) // fewer resources than P2: the +2/+0 applies
        .WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(2, GUARD)
        .WithCardInHandForPlayer(1, COMMENCE).WithCardInHandForPlayer(1, ASAJJ).Build(),
    );

    await g.playCardFromHandAsync(1, 0); // 1 + 2 off-aspect
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2); // Saboteur: the base, past the Sentinel
    expect(isOffer(g)).toBe(true);
    await g.chooseYesAsync(1);

    expect(g.state.player2.base.damage).toBe(7);
    expect(readyResources(g)).toBe(0);
  });

  it("3. Commence the Festivities: Asajj has its Saboteur too", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(
      board(8).FillResourcesForPlayer(2, MARINE, 10)
        .WithGroundUnitForPlayer(1, MARINE).WithGroundUnitForPlayer(1, ASAJJ) // an older copy, so the
        .WithCardInHandForPlayer(1, COMMENCE).WithCardInHandForPlayer(1, ASAJJ).Build(), // attack pauses
    );
    const oldAsajj = g.state.player1.groundArena[1].playId;

    await g.playCardFromHandAsync(1, 0);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [g.state.player1.groundArena[0].playId] });
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1);
    // Paused on the uniqueness choice — before damage, while this attack's effects still apply.
    const newAsajj = g.state.player1.groundArena.find(u => u.cardId === ASAJJ && u.playId !== oldAsajj)!.playId;
    expect(HasSaboteur(ASAJJ, newAsajj, 1)).toBe(true);
    await g.dispatchAsync(1, "choose-target", { targetPlayIds: [oldAsajj] });

    expect(g.state.player2.base.damage).toBe(7);
  });
});
