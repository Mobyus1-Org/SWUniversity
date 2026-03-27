import { CardInPlay, PlayerId, Unit as UnitInterface } from "../../lib/engine/core-models";
import { GetCurrentEffectsForPlayer, LeaderAbilitiesIgnored, TraitContains } from "./core-functions";
import { CardHp, CardPower, CardType, CardUpgradeHp, CardUpgradePower } from "./card-db/generated";
import { CountBounties } from "./card-db/keyword-dictionaries.ts/bounty";

export class Unit implements UnitInterface {
  cardId: string;
  playId: string;
  controller: PlayerId;
  owner: PlayerId;
  ready: boolean;
  damage: number;
  upgrades: CardInPlay[];
  captives: Unit[];
  numUses: number;
  isClone: boolean;

  constructor(cardId: string, playId: string, owner: PlayerId, isClone = false) {
    this.cardId = cardId;
    this.playId = playId;
    this.controller = owner;
    this.owner = owner;
    this.ready = false;
    this.damage = 0;
    this.upgrades = [];
    this.captives = [];
    this.numUses = 0;
    this.isClone = isClone;
  }

  static FromInterface(unit: UnitInterface): Unit {
    const newUnit = new Unit(unit.cardId, unit.playId, unit.owner, unit.isClone);
    newUnit.controller = unit.controller;
    newUnit.ready = unit.ready;
    newUnit.damage = unit.damage;
    newUnit.upgrades = unit.upgrades;
    newUnit.captives = unit.captives.map(c => Unit.FromInterface(c));
    newUnit.isClone = unit.isClone;
    newUnit.numUses = unit.numUses;

    return newUnit;
  }

  IsLeader(): boolean {
    return CardType(this.cardId) === "Leader";
  }

  IsTokenUnit(): boolean {
    switch(this.cardId) {
      case "TWI_T01": //Battle Drod
      case "TWI_T02": //Clone Trooper
      case "JTL_T01": //TIE Fighter
      case "JTL_T02": //X-Wing
      case "SEC_T01": //Spy
        return true;
      default: break;
    }

    return false;
  }

  IsDamaged(): boolean {
    return this.damage > 0;
  }

  LostAbilities(ignoreFirstCardId: string = ""): boolean {
    const currentEffects = GetCurrentEffectsForPlayer(this.controller);

    // Check for effects that prevent abilities
    for (const effect of currentEffects) {
      if (effect.targetPlayId && effect.targetPlayId !== this.playId) continue;

      switch (effect.cardId) {
        case "2639435822": //Force Lightning
        case "4531112134": //Kazuda Xiono leader side
        case "c1700fc85b": //Kazuda Xiono pilot Leader Unit
        case "9184947464": //There Is No Escape
        case "1146162009": //Mind Trick
          return true;
        default: break;
      }
    }

    // Check for upgrades that prevent abilities
    const upgrades = this.upgrades || [];
    let ignoredUpgrade = 0;
    for (const upgrade of upgrades) {
      //in case of Imprisoned, upgrade are added before all triggers, we need to ignore it for Krayt Dragon
      if(ignoreFirstCardId !== "" && upgrade.cardId === ignoreFirstCardId && ignoredUpgrade === 0) {
        ignoredUpgrade++;
        continue;
      }

      switch (upgrade.cardId) {
        case "1368144544"://Imprisoned
          return true;
        default: break;
      }
    }

    if (this.IsLeader() && LeaderAbilitiesIgnored()) {
      return true;
    }

    return false;
  }

  CurrentPower(reportMode: boolean = false): number {
    let power = CardPower(this.cardId) || 0;
    if (this.HasUpgrade("LOF_056")) { //Size Matters Not
      power = 5;
    }

    for(const currentEffect of GetCurrentEffectsForPlayer(this.controller)) {
      if (currentEffect.targetPlayId && currentEffect.targetPlayId !== this.playId) continue;

      switch(currentEffect.cardId) {
        case "SOR_103": //Rebel Assault
          power += 1;
          break;
        case "SOR_168": //Precision Fire
          power += TraitContains(this.cardId, "Trooper", this.controller, this.playId) ? 2 : 0;
          break;
        default: break;
      }
    }

    for (const upgrade of this.upgrades) {
      power += CardPower(upgrade.cardId) || CardUpgradePower(upgrade.cardId) || 0;
    }

    if(reportMode) {
      console.log(`Base power for ${this.cardId} is ${power}`);
    }

    return power;
  }

  CurrentHP(): number {
    return this.TotalHP() - this.damage;
  }

  TotalHP(): number {
    let hp = CardHp(this.cardId) || 0;
    if (this.HasUpgrade("LOF_056")) { //Size Matters Not
      hp = 5;
    }

    for (const upgrade of this.upgrades) {
      hp += CardHp(upgrade.cardId) || CardUpgradeHp(upgrade.cardId) || 0;
    }

    return hp;
  }

  HasUpgrade(cardId: string): boolean {
    return this.upgrades.some(u => u.cardId === cardId);
  }

  HasBounty(): boolean {
    if (CountBounties(this.cardId) > 0) return true;
    if (this.upgrades.some(u => CountBounties(u.cardId) > 0)) return true;
    for (const effect of GetCurrentEffectsForPlayer(this.controller)) {
      if (effect.targetPlayId && effect.targetPlayId !== this.playId) continue;

      switch (effect.cardId) {
        case "SHD_006"://Jabba The Hutt - His High Exaltness's
          return true;
        default: break;
      }
    }

    return false;
  }

  CanUseLimitedAbility(): boolean {
    return this.numUses > 0;
  }
}