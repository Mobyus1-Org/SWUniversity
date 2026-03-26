import { CardHp, CardPower, CardType } from "./card-db/generated";
import { CountBounties } from "./card-db/keyword-dictionaries.ts/bounty";
import { GetCurrentEffectsForPlayer, LeaderAbilitiesIgnored } from "./core-functions";
import { CardInPlay, PlayerId } from "./core-models";

export class Unit implements CardInPlay {
  cardId: string;
  playId: string;
  controller: PlayerId;
  owner: PlayerId;
  ready: boolean;
  damage: number;
  upgrades: CardInPlay[];
  captives: Unit[];
  isClone?: boolean;
  numUses: number;

  constructor(cardId: string, playId: string, player: PlayerId) {
    this.cardId = cardId;
    this.playId = playId;
    this.controller = player;
    this.owner = player;
    this.ready = true;
    this.damage = 0;
    this.upgrades = [];
    this.captives = [];
    this.numUses = 1;
  }

  IsLeader(): boolean {
    return CardType(this.cardId) === "Leader";
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