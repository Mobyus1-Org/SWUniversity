/**
 * The shape of the official SWU card API's responses, plus the dictionary shapes the generator
 * builds from them. Extracted from generator.ts so the mock adapter can produce the same shape
 * without importing the generator (which would be a cycle).
 */

export type SwuMediaFormats = {
  card?: {
    url?: string | null;
  } | null;
} | null;

export type SwuRelationAttributes = {
  code?: string | null;
  englishName?: string | null;
  name?: string | null;
  url?: string | null;
  formats?: SwuMediaFormats;
};

export type SwuRelationData = {
  attributes?: SwuRelationAttributes | null;
} | null;

export type SwuRelation = {
  data?: SwuRelationData;
};

export type SwuRelationList = {
  data?: Array<{
    attributes?: SwuRelationAttributes | null;
  }>;
};

export type SwuCardAttributes = {
  cardId?: string | null;
  title?: string | null;
  subtitle?: string | null;
  cardNumber?: number | string | null;
  cost?: number | null;
  hp?: number | null;
  power?: number | null;
  upgradeHp?: number | null;
  upgradePower?: number | null;
  text?: string | null;
  epicAction?: string | null;
  deployBox?: string | null;
  unique?: boolean | null;
  rarity?: SwuRelation;
  type?: SwuRelation;
  type2?: SwuRelation;
  expansion?: SwuRelation;
  aspects?: SwuRelationList;
  aspectDuplicates?: SwuRelationList;
  traits?: SwuRelationList;
  arenas?: SwuRelationList;
  artFront?: SwuRelation;
  artBack?: SwuRelation;
  artThumbnail?: SwuRelation;
  reprintOf?: {
    data?: {
      attributes?: SwuCardAttributes | null;
    } | null;
  };
};

export type SwuCardRecord = {
  id: number;
  attributes?: SwuCardAttributes | null;
};

export type SwuCardsResponse = {
  data?: SwuCardRecord[];
  meta?: {
    pagination?: {
      page?: number;
      pageCount?: number;
      pageSize?: number;
      total?: number;
    };
  };
};

export type StringDictionary = Record<string, string>;
export type NumberDictionary = Record<string, number>;
export type BooleanDictionary = Record<string, true>;

export type CardDictionaries = {
  cardTitle: StringDictionary;
  cardSubtitle: StringDictionary;
  cardText: StringDictionary;
  cardCost: NumberDictionary;
  cardHp: NumberDictionary;
  cardPower: NumberDictionary;
  cardUpgradeHp: NumberDictionary;
  cardUpgradePower: NumberDictionary;
  cardType: StringDictionary;
  cardType2: StringDictionary;
  cardSet: StringDictionary;
  cardRarity: StringDictionary;
  cardIsUnique: BooleanDictionary;
  cardHasWhenPlayed: BooleanDictionary;
  cardHasWhenDefeated: BooleanDictionary;
  cardLeaderUnitText: StringDictionary;
  cardAspects: StringDictionary;
  cardTraits: StringDictionary;
  cardArena: StringDictionary;
};
