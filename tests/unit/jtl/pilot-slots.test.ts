import { describe, it, expect } from "vitest";
import { GameTestAdapter } from "../game-test-adapter";
import { GameStateBuilder } from "@/server/engine/game-state-builder";
import { Cards } from "../../card-helpers";
import { CardInPlay } from "@/lib/engine/core-models";
import {
  PilotingEligibleVehicles,
  PilotlessVehiclePlayIds,
  IsPilotUpgrade,
} from "@/server/engine/card-db/upgrade-attach-restrictions";

// Pilot slot rules across the three effect classes:
//
//   PLAY / DEPLOY a Pilot  → limited by the Vehicle's pilot capacity.
//       Millennium Falcon (JTL_249): "You may play or deploy 1 additional Pilot on this unit."  → 2
//       R2-D2 (JTL_245) attached:    grants that same additional Pilot                          → +1
//
//   ATTACH ("...to a friendly Vehicle unit without a Pilot on it") → requires ZERO pilots.
//       Poe Dameron leader (JTL_013), Poe Dameron unit (JTL_100), L3-37 (JTL_049).
//       The Falcon/R2 permission covers "play or deploy" ONLY, so it never loosens an attach.

function upg(cardId: string): CardInPlay {
  return { cardId, playId: "@", owner: 1, controller: 1 };
}

const ANAKIN = Cards.units.jtl.anakinSkywalker; // Pilot unit (Piloting 2)
const R2 = Cards.units.jtl.r2d2; // Pilot unit (Piloting 0), grants +1 slot
const POE_LEADER = Cards.leaders.jtl.poeDameron; // Pilot LEADER that attaches (no Piloting cost)
const LUKE_LEADER = Cards.leaders.jtl.lukeSkywalker; // Pilot leader that DEPLOYS as a pilot

function withVehicle(vehicleCardId: string, upgrades: CardInPlay[]) {
  return new GameStateBuilder()
    .MyBase(Cards.bases.common.green30HP)
    .MyLeader(Cards.leaders.sor.sabineWren)
    .TheirBase(Cards.bases.common.green30HP)
    .TheirLeader(Cards.leaders.sor.sabineWren)
    .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
    .WithSpaceUnitForPlayer(1, vehicleCardId)
    .WithUpgradesOnSpaceUnitForPlayer(1, 0, upgrades)
    .Build();
}

const CRAFT = Cards.units.sor.systemPatrolCraft; // ordinary Vehicle — 1 pilot slot
const FALCON = Cards.units.jtl.millenniumFalcon; // 2 pilot slots

describe("Pilot detection — what counts as a Pilot upgrade", () => {
  it("counts Pilot units and Pilot leaders alike, including the attach-only Poe leader", () => {
    expect(IsPilotUpgrade(ANAKIN)).toBe(true); // has a Piloting cost
    expect(IsPilotUpgrade(R2)).toBe(true);
    expect(IsPilotUpgrade(LUKE_LEADER)).toBe(true); // leader that deploys as a pilot
    // Poe leader has NO Piloting cost and no deploy-as-pilot threshold — he attaches. He is
    // still a Pilot, and a Vehicle carrying him must read as piloted.
    expect(IsPilotUpgrade(POE_LEADER)).toBe(true);
  });

  it("does not count non-Pilot upgrades", () => {
    expect(IsPilotUpgrade(Cards.upgrades.token.shield)).toBe(false);
    expect(IsPilotUpgrade(Cards.upgrades.token.experience)).toBe(false);
    expect(IsPilotUpgrade(Cards.upgrades.sor.lukesLightsaber)).toBe(false);
  });
});

describe("PLAY/DEPLOY a Pilot — capacity rules", () => {
  it("an ordinary Vehicle takes 1 Pilot", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(CRAFT, []));
    expect(PilotingEligibleVehicles(g.state, 1, ANAKIN)).toHaveLength(1);

    const g2 = new GameTestAdapter();
    g2.loadNewState(withVehicle(CRAFT, [upg(ANAKIN)]));
    expect(PilotingEligibleVehicles(g2.state, 1, ANAKIN)).toHaveLength(0); // full
  });

  it("the Falcon takes 2 Pilots", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(FALCON, [upg(ANAKIN)]));
    expect(PilotingEligibleVehicles(g.state, 1, ANAKIN)).toHaveLength(1); // 1 of 2 used

    const g2 = new GameTestAdapter();
    g2.loadNewState(withVehicle(FALCON, [upg(ANAKIN), upg(Cards.units.jtl.poeDameron)]));
    expect(PilotingEligibleVehicles(g2.state, 1, ANAKIN)).toHaveLength(0); // 2 of 2 used
  });

  it("R2-D2 may board a Vehicle that is already at its Pilot limit", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(CRAFT, [upg(ANAKIN)])); // ordinary Vehicle, full
    expect(PilotingEligibleVehicles(g.state, 1, ANAKIN)).toHaveLength(0);
    expect(PilotingEligibleVehicles(g.state, 1, R2)).toHaveLength(1); // R2 brings his own slot

    const gf = new GameTestAdapter();
    gf.loadNewState(withVehicle(FALCON, [upg(ANAKIN), upg(Cards.units.jtl.poeDameron)])); // Falcon, full at 2
    expect(PilotingEligibleVehicles(gf.state, 1, R2)).toHaveLength(1);
  });

  it("R2 aboard the Falcon raises it to 3 Pilots, then it is full", () => {
    const two = new GameTestAdapter();
    two.loadNewState(withVehicle(FALCON, [upg(R2), upg(ANAKIN)])); // 2 of 3
    expect(PilotingEligibleVehicles(two.state, 1, ANAKIN)).toHaveLength(1);

    const three = new GameTestAdapter();
    three.loadNewState(withVehicle(FALCON, [upg(R2), upg(ANAKIN), upg(Cards.units.jtl.poeDameron)]));
    expect(PilotingEligibleVehicles(three.state, 1, ANAKIN)).toHaveLength(0); // 3 of 3 — full
    expect(PilotingEligibleVehicles(three.state, 1, R2)).toHaveLength(0); // R2 already aboard: no 2nd slot
  });

  it("a Vehicle carrying the Poe LEADER is full — he occupies the Pilot slot", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(CRAFT, [upg(POE_LEADER)]));
    expect(PilotingEligibleVehicles(g.state, 1, ANAKIN)).toHaveLength(0);
  });
});

describe("ATTACH effects — require a Vehicle with NO Pilot at all", () => {
  it("a pilotless Vehicle is a legal attach target", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(CRAFT, []));
    expect(PilotlessVehiclePlayIds(g.state, 1)).toHaveLength(1);
  });

  it("the Falcon with 1 Pilot has a free slot, but is NOT a legal attach target", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(FALCON, [upg(ANAKIN)]));

    // Play/deploy may still add a Pilot (the Falcon's permission covers "play or deploy")...
    expect(PilotingEligibleVehicles(g.state, 1, ANAKIN)).toHaveLength(1);
    // ...but an ATTACH effect says "without a Pilot on it", and the Falcon has one.
    expect(PilotlessVehiclePlayIds(g.state, 1)).toHaveLength(0);
  });

  it("R2 aboard does not open a Vehicle up to attach effects either", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(FALCON, [upg(R2)]));

    expect(PilotingEligibleVehicles(g.state, 1, ANAKIN)).toHaveLength(1); // free play/deploy slot
    expect(PilotlessVehiclePlayIds(g.state, 1)).toHaveLength(0); // but it is piloted
  });

  it("a Vehicle carrying the Poe LEADER is not a legal attach target", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(CRAFT, [upg(POE_LEADER)]));
    expect(PilotlessVehiclePlayIds(g.state, 1)).toHaveLength(0);
  });
});

// JTL_100 Poe Dameron is the sharpest case: he has BOTH paths on one card.
//   "Piloting [2]"                                            → capacity-limited (play)
//   "You may attach this unit as an upgrade to a friendly
//    Vehicle unit without a Pilot on it"  (When played as a unit) → strict, zero pilots
// So the same Falcon can be legal for one path and illegal for the other.
describe("JTL_100 Poe Dameron — his two paths follow different rules", () => {
  it("may be PLAYED as a Pilot onto a Falcon that already has a Pilot", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(FALCON, [upg(ANAKIN)]));
    expect(PilotingEligibleVehicles(g.state, 1, Cards.units.jtl.poeDameron)).toHaveLength(1);
  });

  it("may NOT self-attach to that same Falcon — 'without a Pilot on it'", () => {
    const g = new GameTestAdapter();
    g.loadNewState(withVehicle(FALCON, [upg(ANAKIN)]));
    expect(PilotlessVehiclePlayIds(g.state, 1)).toHaveLength(0);
  });

  it("end to end: with a piloted Falcon out, he may only attach to the X-Wing he just created", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.jtl.poeDameron)
      .WithSpaceUnitForPlayer(1, FALCON)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upg(ANAKIN)]) // Falcon has a free slot, but IS piloted
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Unit");

    // The X-Wing token he creates is itself a pilotless Vehicle, so it — and ONLY it — is a legal
    // attach target. The Falcon has a free Pilot slot but is not pilotless, so it is excluded.
    const xwing = g.state.player1.spaceArena.find(u => u.cardId === Cards.units.token.xWing)!;
    expect(PilotlessVehiclePlayIds(g.state, 1)).toEqual([xwing.playId]);

    await g.chooseYesAsync(1);
    await g.chooseSpaceUnitAsync(1, 1); // the X-Wing

    expect(g.state.player1.spaceArena[1].upgrades.map(u => u.cardId)).toContain(Cards.units.jtl.poeDameron);
    expect(g.state.player1.spaceArena[0].upgrades).toHaveLength(1); // Falcon untouched
  });

  it("end to end: he CAN be played as a Pilot onto that same piloted Falcon", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, Cards.units.jtl.poeDameron)
      .WithSpaceUnitForPlayer(1, FALCON)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upg(ANAKIN)])
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.chooseSpaceUnitAsync(1, 0);

    const falcon = g.state.player1.spaceArena[0];
    expect(falcon.upgrades.map(u => u.cardId)).toContain(Cards.units.jtl.poeDameron);
    expect(falcon.upgrades).toHaveLength(2); // 2 of the Falcon's 2 slots
    // Played as a Pilot, not as a unit — so no X-Wing token.
    expect(g.state.player1.spaceArena.filter(u => u.cardId === Cards.units.token.xWing)).toHaveLength(0);
  });
});

describe("End to end: R2-D2 boards a full Millennium Falcon", () => {
  it("plays onto a Falcon that already has 2 Pilots, giving it 3", async () => {
    const g = new GameTestAdapter();
    const s = new GameStateBuilder()
      .MyBase(Cards.bases.common.green30HP)
      .MyLeader(Cards.leaders.sor.sabineWren)
      .TheirBase(Cards.bases.common.green30HP)
      .TheirLeader(Cards.leaders.sor.sabineWren)
      .FillResourcesForPlayer(1, Cards.units.sor.battlefieldMarine, 12)
      .WithCardInHandForPlayer(1, R2)
      .WithSpaceUnitForPlayer(1, FALCON)
      .WithUpgradesOnSpaceUnitForPlayer(1, 0, [upg(ANAKIN), upg(Cards.units.jtl.poeDameron)])
      .Build();
    g.loadNewState(s);

    await g.playCardFromHandAsync(1, 0);
    await g.chooseOptionAsync(1, "Play as Pilot");
    await g.chooseSpaceUnitAsync(1, 0);

    const falcon = g.state.player1.spaceArena[0];
    expect(falcon.upgrades.map(u => u.cardId)).toContain(R2);
    expect(falcon.upgrades).toHaveLength(3);
  });
});
