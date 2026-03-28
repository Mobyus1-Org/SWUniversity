import { CardInPlay, PlayerId, Unit as UnitInterface } from "@/lib/engine/core-models";
import { GetCurrentEffectsForPlayer, GetUnitsForPlayer, LeaderAbilitiesIgnored, TraitContains } from "@/server/engine/core-functions";
import { CardHp, CardPower, CardType, CardUpgradeHp, CardUpgradePower } from "@/server/engine/card-db/generated";
import { RaidAmount } from "@/server/engine/card-db/keyword-dictionaries.ts/raid";
import { CountBounties } from "@/server/engine/card-db/keyword-dictionaries.ts/bounty";
import { HasKeyword } from "@/server/engine/card-db/dictionaries";

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
        case "SOR_138": //Force Lightning
        case "JTL_018": //Kazuda Xiono
        case "JTL_244": //There Is No Escape
        case "LOF_202": //Mind Trick
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
        case "SHD_072"://Imprisoned
          return true;
        default: break;
      }
    }

    if (this.IsLeader() && LeaderAbilitiesIgnored()) {
      return true;
    }

    return false;
  }

  CurrentPower(reportMode: boolean = false, isAttacking: boolean = false): number {
    let power = CardPower(this.cardId) || 0;
    if (this.HasUpgrade("LOF_056")) { //Size Matters Not
      power = 5;
    }

    // Check for other units that buff power
    for(const unit of GetUnitsForPlayer(this.controller)) {
      const isOtherUnit = unit.playId !== this.playId;
      switch (unit.cardId) {
        case "SOR_001": //Director Krennic - Aspiring to Authority
          power += this.damage > 0 ? 1 : 0;
          break;
        case "SHD_008": //Boba Fett - Daimyo
          power += isOtherUnit && HasKeyword(this.cardId, "Any", this.playId, this.controller) ? 1 : 0;
          break;
        default: break;
      }
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
        case "SHD_179": //Desperate Attack
          power += 2;
          break;
        default: break;
      }
    }

    for (const upgrade of this.upgrades) {
      power += CardUpgradePower(upgrade.cardId);
    }

    if (isAttacking) {
      power += RaidAmount(this.cardId, this.playId, this.controller);
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
      hp += CardUpgradeHp(upgrade.cardId);
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