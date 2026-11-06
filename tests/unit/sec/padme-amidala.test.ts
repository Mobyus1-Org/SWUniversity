import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";

// SEC_016 Padmé Amidala — What Do You Have to Hide? (Leader, Cunning/Heroism; unit side 3/8 Ground)
//   Front: "When you reveal or discard 1 or more cards from your hand: You may exhaust this leader.
//           If you do, deal 1 damage to a unit.
//           Epic Action: If you control 6 or more resources, deploy this leader."
//   Unit:  "When you reveal or discard 1 or more cards from your hand: You may deal 1 damage to a unit."
// "1 or more" is one batch: a disclose, a "reveals their hand", or a batch of discards (Pillage's
// two) each give one offer. The cards' owner is what matters, whoever's effect it was. "Look at"
// is not a reveal, and deck discards don't count.

const PADME = Cards.leaders.sec.padmeAmidala;
const MARINE = Cards.units.sor.battlefieldMarine;
const TURTLE = Cards.units.ash.dinosaurTurtle;
const PILLAGE = Cards.events.shd.pillage;
const ORNITHOPTER = Cards.units.sec.bardottanOrnithopter; // When Played: may disclose Vigilance, draw
const NALA = Cards.units.sec.nalaSe;                      // On Attack: may disclose Vigilance×2
const SORUNA = Cards.units.ash.queenSoruna;               // When Played: may reveal a unit from hand
const VIGILANT = Cards.units.sor.consularSecurityForce;   // Vigilance/Heroism
const JARJAR = Cards.units.ic27.jarJarBinks;              // On Attack: discard the top card of the deck

function board() {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(PADME)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.grandMoffTarkin)
    .WithActivePlayer(1)
    .FillResourcesForPlayer(1, MARINE, 14)
    .FillResourcesForPlayer(2, MARINE, 14)
    .WithGroundUnitForPlayer(2, TURTLE);
}

const res = (g: GameTestAdapter) => g.lastDispatchResponse?.resolutionNeeded;
const padmeOffer = (g: GameTestAdapter) => {
  const r = res(g);
  return r?.type === "Option" && /Padm|Deal 1 damage/.test(r.helperText ?? "") ? r : undefined;
};
const turtleDamage = (g: GameTestAdapter) => g.state.player2.groundArena.find(u => u.cardId === TURTLE)!.damage;

async function takeIt(g: GameTestAdapter, player: 1 | 2 = 1) {
  await g.chooseYesAsync(player);
  await g.dispatchAsync(player, "choose-target", { targetPlayIds: [g.state.player2.groundArena.find(u => u.cardId === TURTLE)!.playId] });
}

describe("SEC_016 Padmé Amidala — leader side", () => {
  it("discarding from your hand: may exhaust her to deal 1 damage to a unit", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, PILLAGE).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // Pillage: you discard 2
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    expect(padmeOffer(g)).toBeTruthy();
    await takeIt(g);

    expect(turtleDamage(g)).toBe(1);
    expect(g.state.player1.leader.ready).toBe(false);
    expect(res(g)).toBeFalsy(); // one batch, one offer
  });

  it("declining keeps her ready", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, PILLAGE).WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);

    expect(g.state.player1.leader.ready).toBe(true);
    expect(turtleDamage(g)).toBe(0);
  });

  it("an opponent's effect discarding from your hand counts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithActivePlayer(2).WithCardInHandForPlayer(2, PILLAGE)
      .WithCardInHandForPlayer(1, MARINE).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(2, 0);
    await g.chooseNoAsync(2); // the opponent (P1) discards 2
    await g.chooseCardFromHandAsync(1, 0);
    await g.chooseCardFromHandAsync(1, 0);
    expect(padmeOffer(g)).toBeTruthy();
    await takeIt(g);

    expect(turtleDamage(g)).toBe(1);
  });

  it("disclosing (a yes/no disclose that then picks the card) counts as a reveal", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, ORNITHOPTER).WithCardInHandForPlayer(1, VIGILANT)
      .WithCardInDeckForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1); // disclose
    await g.chooseCardFromHandAsync(1, 0);
    expect(g.state.player1.hand.map(c => c.cardId)).toEqual([VIGILANT, MARINE]); // revealed, not discarded; drew
    expect(padmeOffer(g)).toBeTruthy();
    await takeIt(g);

    expect(turtleDamage(g)).toBe(1);
  });

  it("an On Attack disclose (Nala Se) counts, and the attack still lands", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithGroundUnitForPlayer(1, NALA).WithGroundUnitForPlayer(1, MARINE, true, 2)
      .WithCardInHandForPlayer(1, VIGILANT).WithCardInHandForPlayer(1, VIGILANT).Build());

    await g.attackWithGroundUnitAsync(1, 0);
    await g.chooseBaseAsync(1, 2);
    await g.chooseYesAsync(1); // disclose Vigilance×2
    await g.dispatchAsync(1, "choose-target", {
      spreadDamageAssignments: [{ playId: g.state.player1.groundArena[1].playId, damage: 2 }],
    });
    expect(padmeOffer(g)).toBeTruthy();
    await takeIt(g);

    expect(turtleDamage(g)).toBe(1);
    expect(g.state.player2.base.damage).toBe(4);
  });

  it("revealing a card from hand (Queen Soruna) counts", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, SORUNA).WithCardInHandForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseYesAsync(1);
    await g.chooseCardFromHandAsync(1, 0);
    // Soruna's own damage first (a unit with the same cost as the Marine: none here but the Marine itself isn't in play)
    if (res(g)?.type === "Target" && !padmeOffer(g)) {
      const r = res(g);
      await g.dispatchAsync(1, "choose-target", { targetPlayIds: [r?.type === "Target" ? r.fromPlayIds![0] : ""] });
    }
    expect(padmeOffer(g)).toBeTruthy();
  });

  it("not for the opponent's discards, nor a deck discard", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(board().WithCardInHandForPlayer(1, PILLAGE)
      .WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE)
      .WithGroundUnitForPlayer(1, JARJAR).WithCardInDeckForPlayer(1, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // P2 discards 2
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseCardFromHandAsync(2, 0);
    expect(padmeOffer(g)).toBeUndefined();

    await g.dispatchAsync(2, "pass-action", {});
    await g.attackWithGroundUnitAsync(1, g.state.player1.groundArena.findIndex(u => u.cardId === JARJAR));
    await g.chooseBaseAsync(1, 2);
    expect(g.state.player1.discard.map(c => c.cardId)).toContain(MARINE); // milled
    expect(padmeOffer(g)).toBeUndefined();
  });
});

describe("SEC_016 Padmé Amidala — Epic Action", () => {
  it("deploys with 6 resources, not 5", async () => {
    const five = new GameTestAdapter();
    five.loadNewState(board().Build());
    five.state.player1.resources = five.state.player1.resources.slice(0, 5);
    await five.deployLeaderAsync(1);
    expect(five.state.player1.leader.deployed).toBeFalsy();

    const six = new GameTestAdapter();
    six.loadNewState(board().Build());
    six.state.player1.resources = six.state.player1.resources.slice(0, 6);
    await six.deployLeaderAsync(1);
    expect(six.state.player1.leader.deployed).toBe(true);
  });
});

describe("SEC_016 Padmé Amidala — deployed", () => {
  function deployedForP2() {
    return new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.grandMoffTarkin)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(PADME, true, true, true)
      .WithActivePlayer(1)
      .FillResourcesForPlayer(1, MARINE, 14)
      .WithGroundUnitForPlayer(2, PADME)
      .WithGroundUnitForPlayer(1, TURTLE);
  }
  const myTurtle = (g: GameTestAdapter) => g.state.player1.groundArena.find(u => u.cardId === TURTLE)!;

  it("Pillage makes her discard 2: she triggers ONCE, no exhaust needed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedForP2().WithCardInHandForPlayer(1, PILLAGE)
      .WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1); // the opponent (Padmé's controller) discards 2
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseCardFromHandAsync(2, 0);
    expect(padmeOffer(g)).toBeTruthy();
    await g.chooseYesAsync(2);
    await g.dispatchAsync(2, "choose-target", { targetPlayIds: [myTurtle(g).playId] });

    expect(myTurtle(g).damage).toBe(1);
    expect(res(g)).toBeFalsy(); // not a second time for the second card
    expect(g.state.player2.hand).toHaveLength(1);
  });

  it("can be used again for a later batch in the same phase", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedForP2().WithCardInHandForPlayer(1, PILLAGE).WithCardInHandForPlayer(1, PILLAGE)
      .WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE)
      .WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE).Build());

    for (let round = 0; round < 2; round++) {
      await g.playCardFromHandAsync(1, 0);
      await g.chooseNoAsync(1);
      await g.chooseCardFromHandAsync(2, 0);
      await g.chooseCardFromHandAsync(2, 0);
      await g.chooseYesAsync(2);
      await g.dispatchAsync(2, "choose-target", { targetPlayIds: [myTurtle(g).playId] });
      if (round === 0) await g.dispatchAsync(2, "pass-action", {});
    }

    expect(myTurtle(g).damage).toBe(2);
  });

  it("can be passed", async () => {
    const g = new GameTestAdapter();
    g.loadNewState(deployedForP2().WithCardInHandForPlayer(1, PILLAGE)
      .WithCardInHandForPlayer(2, MARINE).WithCardInHandForPlayer(2, MARINE).Build());

    await g.playCardFromHandAsync(1, 0);
    await g.chooseNoAsync(1);
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseCardFromHandAsync(2, 0);
    await g.chooseNoAsync(2);

    expect(myTurtle(g).damage).toBe(0);
  });
});
